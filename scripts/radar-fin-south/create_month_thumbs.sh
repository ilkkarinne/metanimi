#!/bin/bash
IND=_
WIDTH=150
HEIGHT=84
BASE=metanim_radar_anim_southern_finland_base_720p.png
THUMBS_BASE=${HOME}/thumbs/radar/fin_south
S3_THUMBS_BASE=s3://data.metanimi.com/thumbs/radar/fin_south
ARCHIVE_BASE=${HOME}/archive/radar/fin_south
IM_OPTIONS="-limit memory 2.5GiB -limit map 2.5GiB"
AWS_CLI="echo /usr/local/bin/aws"
CONVERT="echo /usr/bin/convert ${IM_OPTIONS}"
DATE=date
ARCHIVE_DIR=
TZ=Europe/Helsinki
TMP=/mnt/tmp/metanimi_thumb_$$

while [[ $# > 0 ]]; do
	key="$1"
	shift
	case $key in
    -m|--month)
    #START=`${DATE} -j -v2d -v0H -v0M -v0S -f '%Y-%m' ${1} +%s`
		START=`${DATE} -d "${1}-02" +%s`
    shift
		;;
    *)
            # unknown option
    ;;
	esac
done
if [ "${START}" = "" ]
then
		#START=`${DATE} -j -v1d -v0H -v0M -v0S +%s`
		START=`${DATE} -d '' +%s`
		START=`${DATE} -u -d "1970-01-01 UTC +${START} seconds -\`${DATE} +%d\` day +2 day" +%s`
fi
#END=`${DATE} -j -v+1m -v-1d -f '%s' ${START} +%s`
END=`${DATE} -u -d "1970-01-01 UTC +${START} second +1 month -1 day +1 minute" +%s`

#echo Generating thumbnails for period `${DATE} -ju -f '%s' ${START} '+%Y-%m-%d %H:%M'` - `${DATE} -ju -f '%s' ${END} '+%Y-%m-%d'`
echo Generating thumbnails for period `${DATE} -d "1970-01-01 UTC +${START} second -1 day"` - `${DATE} -d "1970-01-01 UTC +${END} second -1 day"`
mkdir ${TMP}

for (( TIME = ${START}; TIME <= ${END}; TIME+=86400 )); do
	IND+=_
	#ARCHIVE_DIR=`${DATE} -ju -f '%s' ${TIME} +%Y-%m-%d`
	ARCHIVE_DIR=`${DATE} -u -d "1970-01-01 UTC +${TIME} second" +%Y-%m-%d`
	ARCHIVE=${ARCHIVE_BASE}/${ARCHIVE_DIR}
	#TIMESTR=`${DATE} -ju -f '%s' ${TIME} +%Y-%m-%dT%H:%M:%S.000Z`
	TIMESTR=`${DATE} -u -d "1970-01-01 UTC +${TIME} second" +%Y-%m-%dT%H:%M:%S`.000Z
	echo -n "Generating thumbnail from ${ARCHIVE}/aggr_${TIMESTR}.tiff .."
	if [ -f ${ARCHIVE}/aggr_${TIMESTR}.tiff ]; then
		echo "aggregate found"
		${CONVERT} -quiet -size ${WIDTH}x${HEIGHT} -page +0+0 ${BASE} -resize ${WIDTH}x${WIDTH} -page +0+0 ${ARCHIVE}/aggr_${TIMESTR}.tiff -resize ${WIDTH}x${WIDTH} -transparent 'rgb(204,204,204)' -layers flatten -define png:color-type=6 ${TMP}/thumb_${IND}.png
	else
		echo "aggregate not found, using background only"
		${CONVERT} ${BASE} -resize ${WIDTH}x${WIDTH} -define png:color-type=6 ${TMP}/thumb_${IND}.png
	fi
done
#TIMESTAMP=`${DATE} -ju -f '%s' ${END} '+%Y-%m'`
TIMESTAMP=`${DATE} -u -d "1970-01-01 UTC +${END} second" +%Y-%m`
echo -n "Stiching thumbnails.."
${CONVERT} ${TMP}/thumb_*.png +append -define png:color-type=6 ${THUMBS_BASE}/thumbs_${TIMESTAMP}.png
echo "done."
if [ -f ${THUMBS_BASE}/thumbs_${TIMESTAMP}.png ]
then
	echo -n "Storing thumbnails to S3.."
	${AWS_CLI} s3 cp ${THUMBS_BASE}/thumbs_${TIMESTAMP}.png ${S3_THUMBS_BASE}/ --no-guess-mime-type --content-type 'image/png' --acl public-read --cache-control 'max-age:86400'
	RETVAL=$?
	if [ ! ${RETVAL} -eq 0 ]; then
		echo "Error in storing thumbs."
	fi
fi
echo -n "Cleaning up.."
rm -r ${TMP}
echo "done."