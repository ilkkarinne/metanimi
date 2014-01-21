#!/bin/bash

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

if [ "${START}" = "" ]
then
		START=`date -j -v-1d -v0H -v0M -v0S +%s`
fi
if [ "${END}" = "" ]
then
		END=`date -j -v+23H -v+59M -v+59S -f '%s' ${START} +%s`
fi
for (( TIME = ${START}; TIME <= ${END}; TIME+=86400 )); do
		TIMESTR=`date -j -f '%s' ${TIME} +%Y-%m-%d`
		./create_mpeg4video.sh --start ${TIMESTR}
done