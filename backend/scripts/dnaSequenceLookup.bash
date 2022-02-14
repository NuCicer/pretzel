#!/bin/bash

# Based on dnaSequenceSearch.bash, and about 1/2 the code is common;
# maybe factor to a library script in $resourcesDir/

serverDir=$PWD
# $inContainer is true (0) if running in a container.
[ "$PWD" = / ]; inContainer=$?
case $PWD in
  /)
    # container configuration
    resourcesDir=/app/scripts
    toolsDev=$resourcesDir
    datasetIdDir=$resourcesDir/blast/datasetId
    ;;
  *backend)
    resourcesDir=../resources
    ;;
  *)
    resourcesDir=resources
    ;;
esac
# Default value of toolsDev, if not set above.
unused_var=${toolsDev=$resourcesDir/tools/dev}
unused_var=${samtools=samtools}
unused_var=${datasetIdDir=/mnt/data_blast/blast/datasetId}

# Test if running within container.
# File Handles for errors and warnings to be reported back to the user.
# These can be 3,4 when run from backend/common/utilities/child-process.js : childProcess()
# which opens those file handles, but when running from Flask map them to 2 - stderr.
if [ -e /proc/self/fd/3 ]
then
  F_ERR=3
  F_WARN=4
else
  F_ERR=2
  F_WARN=2
fi


logFile=dnaSequenceLookup.log
(pwd; date; ) >> $logFile
echo $* >> $logFile

[ -d tmp ] || mkdir tmp

set -x
# If running within container then unused args fileName=$1 useFile=$2
# are passed.  If running from Flask server they are not passed.
if [ -e /proc/self/fd/3 ]
then
  fileName=$1
  useFile=$2
  parent=$3
  region=$4
  echo fileName="$fileName", useFile=$useFile, parent="$parent", region=$region  >> $logFile
else
  parent=$1
  region=$(echo "$2" | sed 's/^chr//')
  echo parent="$parent", region=$region  >> $logFile
fi


#-------------------------------------------------------------------------------

# this condition is equivalent to $inContainer.
# ls in the container is busybox and does not support -gG.
if ls -l /bin/ls | fgrep -q /bin/busybox
then
    function ll() { ls -l "$@"; }
else
    function ll() { ls -gG "$@"; }
fi

#-------------------------------------------------------------------------------

function dev_result() {
  region=$1
  echo ">$region"
  echo "C"
}

#-------------------------------------------------------------------------------


#-------------------------------------------------------------------------------

datasetId=$parent
# Sanitize datasetId. Allow only alphanumeric and -._ and space.
datasetId=$(echo "$datasetId" | sed 's/[^-A-Za-z0-9._ ]/_/g')


function datasetId2dbName()
{
  if [ ! -f "$datasetId".dbName ]
  then
    dbName="$datasetId"
    echo 1>&$F_WARN 'Warning:' "no file '$datasetId.dbName', using '$datasetId'"
  elif [ $inContainer -eq 0 ]
  then
    # Can't use soft-link across container boundary, but can pass its path
    # The link may have a trailing /. Ensure that $dir has a trailing /.
    dir=$( [ -L "$datasetId".dir ] && ls -ld "$datasetId".dir | sed 's/.*blast\/GENOME_REFERENCES\///;s/\([^/]\)$/\1\//' )
    dbName=$dir$(cat "$datasetId".dbName)
  else
    dbName="$datasetId".dir/$(cat "$datasetId".dbName)
  fi
  echo "$dbName"
  cd $serverDir
}

# This directory check enables dev_result() for dev / loopback test, when blast is not installed.
if [ -d ../../pretzel.A1 ]
then
  # sleep 10
  # test : dbName=$(datasetId2dbName "$datasetId")
  dev_result "$region"
  status=$?
else 
  # (! does not preserve $?, so if that is required, if cd ... ; then : ; else status=$?; echo 1>&$F_ERR "..."; exit $status; fi;  , and equivalent for each if. )
  status=1
  if ! cd "$datasetIdDir"
  then
    echo 1>&$F_ERR 'Error:' "Genome Database is not configured"
  elif ! dbName=$(datasetId2dbName "$datasetId")
  then
    echo 1>&$F_ERR 'Error:' "Genome datasetId is not configured", "$datasetId"
  elif ! time "$samtools" faidx "$dbName" "$region"
  then
    echo 1>&$F_ERR 'Error:' "Unable to run samtools faidx"
  else
    status=$?	# 0
  fi

fi

# exit $status

#-------------------------------------------------------------------------------
