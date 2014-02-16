#!/bin/bash
START_HOURS_OFFSET=12
END_HOURS_OFFSET=0
CRS=EPSG:3067
TIMESTEP=300
XMIN=-82301.435
XMAX=812638.271
YMIN=6555316.825
YMAX=7058980.567
WIDTH=1280
HEIGHT=720
LAYER=suomi_dbz_eureffin
AGGREGATION_LAYER=suomi_rr24h_eureffin
FMI_APIKEY=ffc6c172-4fc3-4b9e-bdc4-7c1031bb5b90
S3_BUCKET=data.metanimi.com
S3_KEY_BASE=archive/radar/fin_south
TMP=/tmp/metanimi_loader_$$
TZ=Europe/Helsinki
AWS_CLI=aws
WGET=wget
GDALINFO=gdalinfo
GDAL_TRANSLATE=gdal_translate
if [[ $OSTYPE =~ ^darwin.* ]]; then
	DATE=gdate
else
	DATE=date
fi
function download(){
	local BASENAME=${1}
	local LAYERNAME=${2}
	local TIME=${3}
	
	local TIMESTR=`${DATE} -u -d "1970-01-01 UTC +${TIME} seconds" +%Y-%m-%dT%H:%M:%S.000Z`
	local TIMESTAMP=`${DATE} -u -d "1970-01-01 UTC +${TIME} seconds" '+%Y-%m-%d at %H:%M UTC'`
	local ARCHIVE_DIR=`${DATE} -u -d "1970-01-01 UTC +${TIME} seconds" +%Y-%m-%d`
	
	echo -n "${BASENAME} ${TIMESTAMP}.."
	${AWS_CLI} s3api head-object --bucket ${S3_BUCKET} --key ${S3_KEY_BASE}/${ARCHIVE_DIR}/${BASENAME}_${TIMESTR}.tiff > /dev/null 2> /dev/null
	if [ ! $? -eq 0 ]; then
		echo -n "fetch.."
		${WGET} -q -O ${TMP}/raw_${BASENAME}_${TIMESTR}.tiff "http://wms.fmi.fi/fmi-apikey/${FMI_APIKEY}/geoserver/wms?service=WMS&version=1.3.0&request=GetMap&layers=${LAYERNAME}&width=${WIDTH}&height=${HEIGHT}&format=image/geotiff&transparent=true&BBOX=${XMIN},${YMIN},${XMAX},${YMAX}&CRS=${CRS}&time=${TIMESTR}"
		if [ -f ${TMP}/raw_${BASENAME}_${TIMESTR}.tiff ]; then
			echo -n "check.."
			${GDALINFO} -stats ${TMP}/raw_${BASENAME}_${TIMESTR}.tiff | grep "ColorInterp=Palette" > /dev/null 2> /dev/null
			if [ $? -eq 0 ]; then
				echo -n "compress.."
				${GDAL_TRANSLATE} -quiet -co compress=lzw ${TMP}/raw_${BASENAME}_${TIMESTR}.tiff ${TMP}/${BASENAME}_${TIMESTR}.tiff
				if [ $? -eq 0 ]; then
					echo -n "upload.."
					${AWS_CLI} s3 cp --quiet ${TMP}/${BASENAME}_${TIMESTR}.tiff s3://${S3_BUCKET}/${S3_KEY_BASE}/${ARCHIVE_DIR}/ --no-guess-mime-type --content-type "image/tiff"
					if [ $? -eq 0 ]; then
						echo "done."
					else
						echo "error in storing to S3"
					fi
				else
					echo "error in compress, skipping"
				fi
			else
				echo "no-data, skipping"
			fi
		else
			echo "failed to fetch the image"
		fi
	else
		echo "already stored"
	fi
}

START=
END=
FAST=0
while [[ $# > 0 ]]; do
	key="$1"
	shift
	case $key in
    -s|--start)
    START=`${DATE} -d "${1}" +%s`
    shift
    ;;
    -e|--end)
		END=`${DATE} -d "${1}" +%s`
    shift
    ;;
    *)
            # unknown option
    ;;
	esac
done

if [ "${START}" = "" ]; then
	START=`${DATE} -d "-\`${DATE} +%M\` minute -\`${DATE} +%S\` second" +%s`
	if [ ! ${START_HOURS_OFFSET} -eq 0 ]; then
		START=`${DATE} -d "1970-01-01 UTC +${START} second -${START_HOURS_OFFSET} hour" +%s`
	fi
	if [ "${END}" = "" ]; then
		END=`${DATE} -d "-\`${DATE} +%M\` minute -\`${DATE} +%S\` second -1 hour +59 minute +59 second" +%s`
		if [ ! ${END_HOURS_OFFSET} -eq 0 ]; then
			END=`${DATE} -d "1970-01-01 UTC +${END} second -${END_HOURS_OFFSET} hour" +%s`
		fi
	fi
else
	if [ "${END}" = "" ]; then
		END=`${DATE} -d "1970-01-01 UTC +${START} second -\`${DATE} +%M\` minute -\`${DATE} +%S\` second +59 minute +59 second" +%s`
		if [ ! ${END_HOURS_OFFSET} -eq 0 ]; then
			END=`${DATE} -d "1970-01-01 UTC +${END} second -${END_HOURS_OFFSET} hour" +%s`
		fi
	fi
fi

if [ ${END} -lt ${START} ]; then
	END=${START}
fi
echo Loading images between `${DATE} -d "1970-01-01 UTC +${START} seconds"` and `${DATE} -d "1970-01-01 UTC +${END} seconds"`
HOUR=0
mkdir ${TMP}

for (( TIME = ${START}; TIME <= ${END}; TIME+=${TIMESTEP} )); do
		PREV_HOUR=${HOUR}
		HOUR=`${DATE} -d "1970-01-01 UTC +${TIME} second +1 second" +%H`
		if [ ${PREV_HOUR} -gt ${HOUR} ]; then
			LOAD_AGGREGATE=1
		else
			LOAD_AGGREGATE=0
		fi
		download "orig" ${LAYER} ${TIME}
		if [ ${LOAD_AGGREGATE} -eq 1 ]; then
			download "aggr" ${AGGREGATION_LAYER} ${TIME}
		fi
done
rm -r ${TMP}