#!/bin/bash
IND=_
WIDTH=150
HEIGHT=84
BASE=metanim_radar_anim_southern_finland_base_720p.png
THUMBS_BASE=../data.metanimi.com/thumbs/radar/fin_south
S3_THUMBS_BASE=s3://data.metanimi.com/thumbs/radar/fin_south
ARCHIVE_BASE=../data.metanimi.com/archive/radar/fin_south
ARCHIVE_DIR=
TMP=/var/tmp/metanimi_thumb_$$

while [[ $# > 0 ]]; do
	key="$1"
	shift
	case $key in
    -m|--month)
    START=`date -j -v2d -v0H -v0M -v0S -f '%Y-%m' ${1} +%s`
    shift
		;;
    *)
            # unknown option
    ;;
	esac
done
if [ "${START}" = "" ]
then
		START=`date -j -v1d -v0H -v0M -v0S +%s`
fi
END=`date -j -v+1m -v-1d -f '%s' ${START} +%s`

echo Generating thumbnails for period `date -ju -f '%s' ${START} '+%Y-%m-%d'` - `date -ju -f '%s' ${END} '+%Y-%m-%d'`
mkdir ${TMP}

for (( TIME = ${START}; TIME <= ${END}; TIME+=86400 )); do
	IND+=_
	ARCHIVE_DIR=`date -ju -f '%s' ${TIME} +%Y-%m-%d`
	ARCHIVE=${ARCHIVE_BASE}/${ARCHIVE_DIR}
	TIMESTR=`date -ju -f '%s' ${TIME} +%Y-%m-%dT%H:%M:%S.000Z`
	echo -n "Generating thumbnail for ${TIMESTR}.."
	if [ -f ${ARCHIVE}/aggr_${TIMESTR}.tiff ]; then
		echo "aggreagte found"
		convert -quiet -size ${WIDTH}x${HEIGHT} -page +0+0 ${BASE} -resize ${WIDTH}x${WIDTH} -page +0+0 ${ARCHIVE}/aggr_${TIMESTR}.tiff -resize ${WIDTH}x${WIDTH} -transparent 'rgb(204,204,204)' -layers flatten -define png:color-type=6 ${TMP}/thumb_${IND}.png
	else
		echo "aggregate not found, using background only"
		convert ${BASE} -resize ${WIDTH}x${WIDTH} -define png:color-type=6 ${TMP}/thumb_${IND}.png
	fi
done
TIMESTAMP=`date -ju -f '%s' ${END} '+%Y-%m'`
echo -n "Stiching thumbnails.."
convert ${TMP}/thumb_*.png +append -define png:color-type=6 ${THUMBS_BASE}/thumbs_${TIMESTAMP}.png
echo "done."
if [ -f ${THUMBS_BASE}/thumbs_${TIMESTAMP}.png ]
then
	echo -n "Storing thumbnails to S3.."
	aws --profile metanimi s3 cp ${THUMBS_BASE}/thumbs_${TIMESTAMP}.png ${S3_THUMBS_BASE}/ --no-guess-mime-type --content-type 'image/png' --acl public-read --cache-control 'max-age:86400'
	RETVAL=$?
	if [ ! ${RETVAL} -eq 0 ]; then
		echo "Error in storing thumbs."
	fi
fi
echo -n "Cleaning up.."
rm -r ${TMP}
echo "done."