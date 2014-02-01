#!/bin/bash
IND=0
MORPH_IMAGES=2
WIDTH=1280
HEIGHT=720
BASE=metanim_radar_anim_southern_finland_base_720p.png
OVERLAY=metanim_radar_anim_southern_finland_overlay_720p.png
TIMESTR=
TIMESTAMP=
ARCHIVE_DIR=
VIDEO_BASE=../data.metanimi.com/video/radar/daily/fin_south
ARCHIVE_BASE=../data.metanimi.com/archive/radar/fin_south
S3_VIDEO_BASE=s3://data.metanimi.com/video/radar/daily/fin_south
TMP=/var/tmp/metanimi_video_$$

while [[ $# > 0 ]]; do
	key="$1"
	shift
	case $key in
    -s|--start)
    START=`date -j -v0H -v0M -v0S -f '%Y-%m-%d' ${1} +%s`
    shift
    ;;
    -e|--end)
		END=`date -j -v23H -v59M -v59S -f '%Y-%m-%d' ${1} +%s`
    shift
    ;;
    -m|--morph)
		MORPH_IMAGES=${1}
		shift
    ;;
    *)
            # unknown option
    ;;
	esac
done

mkdir ${TMP}

if [ "${START}" = "" ]
then
		START=`date -j -v-1d -v0H -v0M -v0S +%s`
fi
if [ "${END}" = "" ]
then
		END=`date -j -v+23H -v+59M -v+59S -f '%s' ${START} +%s`
fi
for (( TIME = ${START}; TIME <= ${END}; TIME+=300 )); do
		ARCHIVE_DIR=`date -ju -f '%s' ${TIME} +%Y-%m-%d`
		ARCHIVE=${ARCHIVE_BASE}/${ARCHIVE_DIR}
		TIMESTR=`date -ju -f '%s' ${TIME} +%Y-%m-%dT%H:%M:%S.000Z`
		TIMESTAMP=`date -ju -f '%s' ${TIME} '+%Y-%m-%d at %H:%M UTC'`
		if [ -f ${ARCHIVE}/orig_${TIMESTR}.tiff ]
		then
			echo -n "${TIMESTAMP}: Processing and adding timestamp.."
			IND=`expr ${IND} + 1`
			convert -quiet ${ARCHIVE}/orig_${TIMESTR}.tiff -alpha set -transparent 'rgb(204,204,204)' -alpha extract -alpha off -negate ${TMP}/mask_$TIMESTR.png
			RETVAL=$?
			if [ ! ${RETVAL} -eq 0 ]; then
				exit ${RETVAL}
			fi
			convert -quiet ${ARCHIVE}/orig_${TIMESTR}.tiff -median 4 -mask ${TMP}/mask_${TIMESTR}.png -attenuate 10 +noise uniform +mask -transparent 'rgb(204,204,204)' -annotate +10+10 "${TIMESTAMP}" -define png:color-type=6 ${TMP}/rad_${IND}.png
			RETVAL=$?
			if [ ! ${RETVAL} -eq 0 ]; then
				exit ${RETVAL}
			fi
			echo "done."
			PREV_TIMESTR=${TIMESTR}
		else
			if [ ! "$PREV_TIMESTR" == "" ]
			then
				echo -n "Failed to get source image ${TIMESTR}, using previous time ${PREV_TIMESTR} instead.."
				IND=`expr ${IND} + 1`
				convert -quiet $ARCHIVE/orig_${PREV_TIMESTR}.tiff -alpha set -transparent 'rgb(204,204,204)' -alpha extract -alpha off -negate ${TMP}/mask_${TIMESTR}.png
				RETVAL=$?
				if [ ! ${RETVAL} -eq 0 ]; then
					exit ${RETVAL}
				fi
				convert -quiet ${ARCHIVE}/orig_${PREV_TIMESTR}.tiff -median 4 -mask ${TMP}/mask_${TIMESTR}.png -attenuate 10 +noise uniform +mask -transparent 'rgb(204,204,204)' -annotate +10+10 "${TIMESTAMP}*" -define png:color-type=6 $TMP/rad_$IND.png
				RETVAL=$?
				if [ ! ${RETVAL} -eq 0 ]; then
					exit ${RETVAL}
				fi
				echo "done."
			fi
		fi
done
if [ $IND -gt 0 ]
then
	echo "$IND source images prepared for the video"
	if [ ${MORPH_IMAGES} -gt 0 ]; then
		echo -n "Interpolating ${MORPH_IMAGES} frames between every original image.."
		convert "${TMP}/rad_%d.png[1-${IND}]" -morph ${MORPH_IMAGES} -define png:color-type=6 ${TMP}/rad_%d.morph.png
		RETVAL=$?
		if [ ! ${RETVAL} -eq 0 ]; then
			exit ${RETVAL}
		fi
		echo "done."
	fi
	FRAMES=`expr ${IND} '*' '(' ${MORPH_IMAGES} + 1 ')'`
	OUT1='ma_rad_fin_s'
	OUT2=`date -ju -f '%s' ${START} +%Y-%m-%d_%H-%M`
	OUT3=`date -ju -f '%s' ${END} +%Y-%m-%d_%H-%M`
	OUT=${VIDEO_BASE}/${OUT1}'_'${OUT2}'_'${OUT3}
	echo -n "Creating movie ${OUT} from the ${FRAMES} source images.."
	if [ ${MORPH_IMAGES} -gt 0 ]; then
		FRAME_BASE_NAME='rad_%d.morph.png'
	else
		FRAME_BASE_NAME='rad_%d.png'
	fi
	ffmpeg -v quiet -y -loop 1 -i ${BASE} -i ${TMP}/${FRAME_BASE_NAME} -i ${OVERLAY} -filter_complex "overlay [tmp]; [tmp] overlay" -c:v libvpx -crf 10 -b:v 4M -c:a copy -vframes ${FRAMES} -f webm ${OUT}.webm
	ffmpeg -v quiet -y -loop 1 -i ${BASE} -i ${TMP}/${FRAME_BASE_NAME} -i ${OVERLAY} -filter_complex "overlay [tmp]; [tmp] overlay" -c:v libx264 -tune animation -movflags +faststart -profile:v main -level 4.0 -crf 23 -c:a copy -vframes ${FRAMES} -f mp4 ${OUT}.mp4
	echo "done."
	
	EXPIRES_DATE=`date -v+12m +'%a, %d %b %Y 00:00:01 GMT'`
	if [ -f "${OUT}.webm" ]
	then
		echo -n "Storing webm video to S3.."
		aws --profile metanimi s3 cp ${OUT}.webm ${S3_VIDEO_BASE}/ --no-guess-mime-type --content-type 'video/webm' --acl public-read --cache-control 'public' --expires "${EXPIRES_DATE}"
		RETVAL=$?
		if [ ! ${RETVAL} -eq 0 ]; then
			echo "Error in storing video."
		fi
	fi
	if [ -f "${OUT}.mp4" ]
	then
		echo -n "Storing mpeg4 video to S3.."
		aws --profile metanimi s3 cp ${OUT}.mp4 ${S3_VIDEO_BASE}/ --no-guess-mime-type --content-type 'video/mp4' --acl public-read --cache-control 'public' --expires "${EXPIRES_DATE}"
		RETVAL=$?
		if [ ! ${RETVAL} -eq 0 ]; then
			echo "Error in storing video."
		fi
	fi
else
	echo "No input images, nothing to do."
fi
echo -n "Cleaning up.."
rm -r ${TMP}
echo "done."