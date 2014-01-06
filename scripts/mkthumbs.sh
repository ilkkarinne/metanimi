#!/bin/bash
START=`date -j -v12d -v00H +%s`
END=`date -j -v16d -v00H -v59M +%s`
START_HOURS_OFFSET=0
END_HOURS_OFFSET=0
CRS=EPSG:3067
XMIN=59445.203
XMAX=759625.205
YMIN=6609018.867
YMAX=7136103.145
WIDTH=147
HEIGHT=110
BASE=southern_finland_base_thumb.png
LAYER=suomi_rr24h_eureffin
FMI_APIKEY=ffc6c172-4fc3-4b9e-bdc4-7c1031bb5b90
TIMESTR=
ARCHIVE=./archive/daily
BASEFNAME=rr24h_thumb
TMP=/var/tmp/rad_thumb_$$
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
TIMESTEP=60*60*24
for (( TIME = $START; TIME <= $END; TIME+=$TIMESTEP )); do
	TIMESTR=`date -ju -f '%s' $TIME +%Y-%m-%dT%H:%M:%S.000Z`
	DATESTR=`date -ju -f '%s' $TIME +%Y-%m-%d`
	if [ ! -f $ARCHIVE/orig_"$BASEFNAME"_"$DATESTR".tiff ]
  then
		echo -n "Fetching $DATESTR.."
		wget -O $TMP/orig_"$BASEFNAME"_"$DATESTR".tiff "http://wms.fmi.fi/fmi-apikey/$FMI_APIKEY/geoserver/Radar/wms?service=WMS&version=1.3.0&request=GetMap&layers=$LAYER&style=Radar+accumulation&width=$WIDTH&height=$HEIGHT&format=image/geotiff&BBOX=$XMIN,$YMIN,$XMAX,$YMAX&CRS=$CRS&transparent=true&time="$TIMESTR
		echo "done."
		if [ -f $TMP/orig_"$BASEFNAME"_"$DATESTR".tiff ]
		then
			echo -n "Compressing GeoTIFF for archiving.."
			gdal_translate -co compress=lzw $TMP/orig_"$BASEFNAME"_"$DATESTR".tiff $ARCHIVE/orig_"$BASEFNAME"_"$DATESTR".tiff
			echo "done."
		fi
	fi
	if [ -f $ARCHIVE/orig_"$BASEFNAME"_"$DATESTR".tiff ]
	then
		echo -n "Converting tiff to png.."
		convert -quiet $ARCHIVE/orig_"$BASEFNAME"_"$DATESTR".tiff -transparent 'rgb(204,204,204)' -define png:color-type=6 $TMP/orig_"$BASEFNAME"_"$DATESTR".png
		echo "done."
		echo -n "Overlaying with background map.."
		composite -quiet $TMP/orig_"$BASEFNAME"_"$DATESTR".png $BASE -define png:color-type=6 $ARCHIVE/composite_"$BASEFNAME"_"$DATESTR".png
		echo "done."
	else
		echo "Failed to fetch the image, skipping this day"
	fi
done
echo -n "Cleaning up.."
rm -r $TMP
echo "done."