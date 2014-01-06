#!/bin/bash
START=`date -j -v12m -v17d -v00H +%s`
END=`date -j -v12m -v17d -v23H -v59M +%s`
START_HOURS_OFFSET=0
END_HOURS_OFFSET=0
IND=0
MORPH_IMAGES=2
CRS=EPSG:3067
XMIN=-82301.435
XMAX=812638.271
YMIN=6555316.825
YMAX=7058980.567
WIDTH=1280
HEIGHT=720
BASE=metanim_southern_finland_base_720p.png
OVERLAY=metanim_radar_anim_southern_finland_overlay_720p.png
LAYER=suomi_rr_eureffin
FMI_APIKEY=ffc6c172-4fc3-4b9e-bdc4-7c1031bb5b90
TIMESTR=
TIMESTAMP=
ARCHIVE_DIR=
OUTPUT_BASE=../data.metanimi.com/video/radar/daily/fin_south
ARCHIVE_BASE=../data.metanimi.com/archive/radar/fin_south
S3_ARCHIVE_BASE=s3://data.metanimi.com/archive/radar/fin_south
S3_VIDEO_BASE=s3://data.metanimi.com/video/radar/daily/fin_south
TMP=/var/tmp/rad_anim_$$
mkdir $TMP

if [ "$START" = "" ]
then
    START=`date -ju +%s`
fi
if [ ! $START_HOURS_OFFSET -eq 0 ]
then
    START=`date -ju -v-"$START_HOURS_OFFSET"H +%s`
fi
START=`date -ju -v0M -v0S -f '%s' $START +%s`

if [ "$END" = "" ]
then
    END=`date -ju +%s`
fi
if [ ! $END_HOURS_OFFSET -eq 0 ]
then
    END=`date -ju -v-"$END_HOURS_OFFSET"H +%s`
fi
END=`date -ju -v59S -f '%s' $END +%s`

for (( TIME = $START; TIME <= $END; TIME+=300 )); do
    ARCHIVE_DIR=`date -ju -f '%s' $TIME +%Y-%m-%d`
    ARCHIVE=$ARCHIVE_BASE/$ARCHIVE_DIR
		mkdir -p $ARCHIVE
		TIMESTR=`date -ju -f '%s' $TIME +%Y-%m-%dT%H:%M:%S.000Z`
		TIMESTAMP=`date -ju -f '%s' $TIME '+%Y-%m-%d at %H:%M UTC'`
		if [ ! -f $ARCHIVE/orig_$TIMESTR.tiff ]
		then
			echo -n "Fetching $TIMESTAMP from the remote archive.."
			aws --profile metanimi s3 cp $S3_ARCHIVE_BASE/$ARCHIVE_DIR/orig_$TIMESTR.tiff $ARCHIVE/
			if [ ! -f $ARCHIVE/orig_$TIMESTR ]
			then
			  echo "Not found."
			  echo -n "Fetching $TIMESTAMP from wms.fmi.fi.."
				wget -q -O $TMP/orig_$TIMESTR.tiff "http://wms.fmi.fi/fmi-apikey/$FMI_APIKEY/geoserver/Radar/wms?service=WMS&version=1.3.0&request=GetMap&layers=$LAYER&width=$WIDTH&height=$HEIGHT&format=image/geotiff&BBOX=$XMIN,$YMIN,$XMAX,$YMAX&CRS=$CRS&transparent=true&time="$TIMESTR
				if [ -f $TMP/orig_$TIMESTR.tiff ] 
				then
					gdalinfo -stats $TMP/orig_$TIMESTR.tiff | grep "ColorInterp=Palette" > /dev/null
					if [ $? == 0 ]
					then
						echo "OK."
						echo -n "Compressing GeoTIFF for archiving.."
						gdal_translate -quiet -co compress=lzw $TMP/orig_$TIMESTR.tiff $ARCHIVE/orig_$TIMESTR.tiff
						if [ $? == 0 ]
						then
							echo "done."					
							echo -n "Uploading GeoTIFF in S3 archive.."
							aws --profile metanimi s3 cp $ARCHIVE/orig_$TIMESTR.tiff $S3_ARCHIVE_BASE/$ARCHIVE_DIR/ --no-guess-mime-type --content-type "image/tiff"
							if [ $? == 0 ]
							then
								echo "done."							
							else
								echo "Error in storing to S3, local copy still ok."
							fi
						else
							echo "Error, skipping this frame"
						fi
					else
						echo "Error, skipping this frame"
					fi
				else
					echo "Failed to fetch the image, skipping this frame"
				fi
			fi
		else
			echo "$TIMESTAMP already in the local archive."
		fi
		if [ -f $ARCHIVE/orig_$TIMESTR.tiff ]
		then
			echo -n "Processing image and adding timestamp.."
			IND=`expr $IND + 1`
			convert -quiet $ARCHIVE/orig_$TIMESTR.tiff -alpha set -transparent 'rgb(204,204,204)' -alpha extract -alpha off -negate $TMP/mask_$TIMESTR.png
			convert -quiet $ARCHIVE/orig_$TIMESTR.tiff -median 4 -mask $TMP/mask_$TIMESTR.png -attenuate 10 +noise uniform +mask -transparent 'rgb(204,204,204)' -annotate +30+165 "$TIMESTAMP" -define png:color-type=6 $TMP/rad_$IND.png
			echo "done."
			PREV_TIMESTR=$TIMESTR
		else
			if [ ! "$PREV_TIMESTR" == "" ]
			then
				echo -n "Failed to get source image $TIMESTR, using previous time $PREV_TIMESTR instead.."
				IND=`expr $IND + 1`
				convert -quiet $ARCHIVE/orig_$PREV_TIMESTR.tiff -alpha set -transparent 'rgb(204,204,204)' -alpha extract -alpha off -negate $TMP/mask_$TIMESTR.png
				convert -quiet $ARCHIVE/orig_$PREV_TIMESTR.tiff -median 4 -mask $TMP/mask_$TIMESTR.png -attenuate 10 +noise uniform +mask -transparent 'rgb(204,204,204)' -annotate +30+165 "$TIMESTAMP *" -define png:color-type=6 $TMP/rad_$IND.png
				echo "done."
			fi
		fi
done
if [ $IND -gt 0 ]
then
	echo "$IND source images prepared for the movie"
	echo -n "Interpolating $MORPH_IMAGES frames between every original image.."
	convert "$TMP/rad_%d.png[1-$IND]" -morph $MORPH_IMAGES -define png:color-type=6 $TMP/rad_%05d.morph.png
	echo "done."
	FRAMES=`expr $IND '*' '(' $MORPH_IMAGES + 1 ')'`
	OUT1='ma_rad_fin_s'
	OUT2=`date -ju -f '%s' $START +%Y-%m-%d_%H-%M`
	OUT3=`date -ju -f '%s' $END +%Y-%m-%d_%H-%M`
	OUT=$OUTPUT_BASE/$OUT1'_'$OUT2'_'$OUT3.webm
	echo -n "Creating movie $OUT from the interpolated $FRAMES images.."
	ffmpeg -v quiet -y -loop 1 -i $BASE -i $TMP/rad_%05d.morph.png -i $OVERLAY -filter_complex "overlay [tmp]; [tmp] overlay" -c:v libvpx -crf 10 -b:v 4M -c:a copy -vframes $FRAMES -f webm $OUT
	echo "done."
	if [ -f $OUT ]
	then
	  EXPIRES_DATE=`date -d '+12 months' +'%a, %d %b %Y 00:00:01 GMT'`
		echo -n "Storing video to S3.."
		aws --profile metanimi s3 cp $OUT $S3_VIDEO_BASE/ --no-guess-mime-type --content-type "video/webm" --acl public-read --cache-control "public" --expires "$EXPIRES_DATE"
		if [ $? == 0 ]
		then
			echo "done."
		else
			echo "Error in storing video."
		fi 
	fi
else
	echo "No input images."
fi 
echo -n "Cleaning up.."
rm -r $TMP
echo "done."