#!/bin/bash
START=`date -j -v11d -v00H +%s`
END=`date -j -v15d -v00H -v59M +%s`
START_HOURS_OFFSET=0
END_HOURS_OFFSET=0
IND=0
MORPH_IMAGES=2
CRS=EPSG:3067
XMIN=59445.203
XMAX=759625.205
YMIN=6609018.867
YMAX=7136103.145
WIDTH=990
HEIGHT=745
BASE=southern_finland_base3.png
LAYER=suomi_rr24h_eureffin
FMI_APIKEY=ffc6c172-4fc3-4b9e-bdc4-7c1031bb5b90
TIMESTR=
ARCHIVE=./archive/sum
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

#24h step
TIMESTEP=60*60*12

for (( TIME = $START; TIME <= $END; TIME+=$TIMESTEP )); do
    TIMESTR=`date -ju -f '%s' $TIME +%Y-%m-%dT%H:%M:%S.000Z`
    if [ ! -f $ARCHIVE/orig_$TIMESTR.tiff ]
    then
	echo -n "Fetching $TIMESTR.."
	sleep 1
	wget -O $TMP/orig_$TIMESTR.tiff "http://wms.fmi.fi/fmi-apikey/$FMI_APIKEY/geoserver/Radar/wms?service=WMS&version=1.3.0&request=GetMap&layers=$LAYER&style=Radar+accumulation&width=$WIDTH&height=$HEIGHT&format=image/geotiff&BBOX=$XMIN,$YMIN,$XMAX,$YMAX&CRS=$CRS&transparent=true&time="$TIMESTR
	echo "done."
	if [ -f $TMP/orig_$TIMESTR.tiff ] 
	then
	    echo -n "Compressing GeoTIFF for archiving.."
	    gdal_translate -co compress=lzw $TMP/orig_$TIMESTR.tiff $ARCHIVE/orig_$TIMESTR.tiff
	    echo "done."
	    echo -n "Adding timestamp and converting image to png.."
	    convert -quiet $TMP/orig_$TIMESTR.tiff -transparent 'rgb(204,204,204)' -gravity northeast -annotate 0 $TIMESTR -define png:color-type=6 $ARCHIVE/orig_$TIMESTR.png
	    echo "done."
	else
	    echo "Failed to fetch the image, skipping this frame"
	fi
    fi
    if [ -f $ARCHIVE/orig_$TIMESTR.png ]
    then
	IND=`expr $IND + 1`
	echo -n "Copying $TIMESTR to seq #$IND.."
	cp $ARCHIVE/orig_$TIMESTR.png $TMP/rad_$IND.png
	echo "done."
    fi
done
echo "$IND original images successfully prepared for the movie"
echo -n "Interpolating $MORPH_IMAGES frames between every original image.."
convert "$TMP/rad_%d.png[1-$IND]" -morph $MORPH_IMAGES -define png:color-type=6 $TMP/rad_%05d.morph.png
echo "done."
FRAMES=`expr $IND '*' '(' $MORPH_IMAGES + 1 ')'`
OUT1='rrsum_anim'
OUT2=`date -ju -f '%s' $START +%Y-%m-%d_%H-%M`
OUT3=`date -ju -f '%s' $END +%Y-%m-%d_%H-%M`
OUT=$OUT1'_'$OUT2'_'$OUT3.webm
echo -n "Creating movie $OUT from the interpolated $FRAMES images.."
ffmpeg -v quiet -y -loop 1 -i $BASE -i $TMP/rad_%05d.morph.png -c:v libvpx -crf 10 -b:v 4M -c:a copy -filter_complex overlay -vframes $FRAMES -f webm  $OUT
echo "done."
echo -n "Cleaning up.."
rm -r $TMP
echo "done."