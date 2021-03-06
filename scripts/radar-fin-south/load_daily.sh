#!/bin/bash
START_HOURS_OFFSET=24
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
TMP=/mnt/tmp/metanimi_loader_$$
TZ=Europe/Helsinki
ARCHIVE_BASE=${HOME}/archive/radar/fin_south
AWS_CLI=aws
WGET=wget
GDALINFO=gdalinfo
GDAL_TRANSLATE=gdal_translate
DATE=date

function download(){
	local BASENAME=${1}
	local LAYERNAME=${2}
	local TIME=${3}
	local SKIP_S3_CHECK=${4}
	
	local TIMESTR=`${DATE} -u -d "1970-01-01 UTC +${TIME} seconds" +%Y-%m-%dT%H:%M:%S.000Z`
	local TIMESTAMP=`${DATE} -u -d "1970-01-01 UTC +${TIME} seconds" '+%Y-%m-%d at %H:%M UTC'`
	local ARCHIVE_DIR=`${DATE} -u -d "1970-01-01 UTC +${TIME} seconds" +%Y-%m-%d`
	local ARCHIVE=${ARCHIVE_BASE}/${ARCHIVE_DIR}
	local STORED_IN_S3=0
	mkdir -p ${ARCHIVE}
	
	if [ ! -f ${ARCHIVE}/${BASENAME}_$TIMESTR.tiff ]; then
		echo -n "Fetching $BASENAME $TIMESTAMP from the remote archive.."
		${AWS_CLI} s3 cp --quiet s3://${S3_BUCKET}/${S3_KEY_BASE}/${ARCHIVE_DIR}/${BASENAME}_${TIMESTR}.tiff ${ARCHIVE}/
		if [ ! -f ${ARCHIVE}/${BASENAME}_${TIMESTR}.tiff ]; then
			STORED_IN_S3=-1
		  echo "Not found."
		  echo -n "Fetching ${BASENAME} ${TIMESTAMP} from wms.fmi.fi.."
			${WGET} -q -O ${TMP}/${BASENAME}_${TIMESTR}.tiff "http://wms.fmi.fi/fmi-apikey/${FMI_APIKEY}/geoserver/Radar/wms?service=WMS&version=1.3.0&request=GetMap&layers=${LAYERNAME}&width=${WIDTH}&height=${HEIGHT}&format=image/geotiff&BBOX=${XMIN},${YMIN},${XMAX},${YMAX}&CRS=${CRS}&transparent=true&time=${TIMESTR}"
			if [ -f ${TMP}/${BASENAME}_${TIMESTR}.tiff ]; then
				${GDALINFO} -stats ${TMP}/${BASENAME}_${TIMESTR}.tiff | grep "ColorInterp=Palette" > /dev/null
				if [ $? -eq 0 ]; then
					echo "OK."
					echo -n "Compressing GeoTIFF for archiving.."
					${GDAL_TRANSLATE} -quiet -co compress=lzw ${TMP}/${BASENAME}_${TIMESTR}.tiff ${ARCHIVE}/${BASENAME}_${TIMESTR}.tiff
					if [ $? -eq 0 ]; then
						echo "done."
					else
						echo "Error in compress, skipping this image"
					fi
				else
					echo "No-data, skipping this image"
				fi
			else
				echo "Failed to fetch the image from wms.fmi.fi."
			fi
		else
			echo "done."
			STORED_IN_S3=1
		fi
	else
		echo "${BASENAME} ${TIMESTAMP} already in the local archive."
	fi
	if [ -f ${ARCHIVE}/${BASENAME}_${TIMESTR}.tiff ] && [ ${SKIP_S3_CHECK} -eq 0 ]; then
		if [ $STORED_IN_S3 -eq 0 ] ; then
			echo -n "Check if this archive file is already stored in S3.."
			${AWS_CLI} s3api head-object --bucket ${S3_BUCKET} --key ${S3_KEY_BASE}/${ARCHIVE_DIR}/${BASENAME}_${TIMESTR}.tiff
			if [ ! $? -eq 0 ]; then
				STORED_IN_S3=-1
			else
				STORED_IN_S3=1
			fi
		fi
		if [ ${STORED_IN_S3} -eq -1 ]; then
			echo -n "Uploading to S3.."
			${AWS_CLI} s3 cp --quiet ${ARCHIVE}/${BASENAME}_${TIMESTR}.tiff s3://${S3_BUCKET}/${S3_KEY_BASE}/${ARCHIVE_DIR}/ --no-guess-mime-type --content-type "image/tiff"
			if [ $? -eq 0 ]; then
				echo "done."
			else
				echo "Error in storing to S3"
			fi
		else
			echo "Already stored in S3"
		fi
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
    -f|--fast)
    FAST=1
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
			#END=`${DATE} -j -v-"${END_HOURS_OFFSET}"H -v59M -v59S +%s`
			END=`${DATE} -d "1970-01-01 UTC +${END} second -${END_HOURS_OFFSET} hour" +%s`
		fi
	fi
else
	if [ "${END}" = "" ]; then
		END=`${DATE} -d "1970-01-01 UTC +${START} second -\`${DATE} +%M\` minute -\`${DATE} +%S\` second +59 minute +59 second" +%s`
		if [ ! ${END_HOURS_OFFSET} -eq 0 ]; then
			#END=`${DATE} -j -v-"${END_HOURS_OFFSET}"H -v59M -v59S -f '%s' ${START} +%s`
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
		download "orig" ${LAYER} ${TIME} ${FAST}
		if [ ${LOAD_AGGREGATE} -eq 1 ]; then
			echo "Last step for a local day, also downloading daily aggregate.."
			download "aggr" ${AGGREGATION_LAYER} ${TIME} ${FAST}
		fi
done
echo -n "Cleaning up.."
rm -r ${TMP}
echo "done"