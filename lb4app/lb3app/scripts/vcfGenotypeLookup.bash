#!/bin/bash

# Based on dnaSequenceSearch.bash / dnaSequenceLookup.bash, and about 1/2 the code is common;
# maybe factor to a library script in $resourcesDir/

# called from : common/utilities/vcf-genotype.js : vcfGenotypeLookup()

# optional - passed when called via 
# @param fileName
# @param useFile
#
# Required :
# @param command	query | view | isec
# @param datasetIdParam - name of VCF dataset directory to lookup
# Currently the the mongo database id of the dataset maps directly to
# the VCF dir name, but could be e.g. dataset.meta.vcfFilename.
# The dataset is a datablock not a reference / parent.
# @param scope		chromosome name, e.g. 1A
# @param isecFlags	none, or e.g. '-n=2', '-n~1100'
# @param isecDatasetIds	none, or names of VCF datasets,
# i.e. 1 or more datasetId, joined with !; 
# where datasetId is a datablock not a reference / parent.
# This is split into the array isecDatasetIdsArray.
# When isecDatasetIds is given, -R is used, so -r should not be given.
# @param preArgs	remaining args : $*
# preArgs may contain -queryStart paramsForQuery -queryEnd
# paramsForQuery : Params passed to query if view|query is used, otherwise to command.


#  args to bcftools other than command vcfGz; named preArgs because they could
#  be inserted between command and vcfGz arguments to bcftools.

# stdin : not read
# stdout : echo $vcfGz to stdout - see dbName2Vcf().
# stderr : set -x is used, which outputs to stderr, and appears in the node.js server stderr log


serverDir=$PWD
# $inContainer is true (0) if running in a container.
[ "$PWD" = / ]; inContainer=$?
case $PWD in
  /)
    # container configuration
    # resourcesDir=$scriptsDir
    resourcesDir=${scriptsDir=/app/lb3app/scripts}
    toolsDev=$resourcesDir
    ;;
  *backend)
    resourcesDir=../resources
    ;;
  *)
    resourcesDir=resources
    ;;
esac
# relative to $serverDir
unused_var=${scriptsDir=lb3app/scripts}
# Default value of toolsDev, if not set above.
unused_var=${toolsDev=$resourcesDir/tools/dev}
unused_var=${bcftools=bcftools}
# or /faidx after blast/
unused_var=${blastDir:=/mnt/data_blast}
# unused_var=${vcfDir:=$blastDir/../vcf}
# blastDir=tmp/blast
set -x
vcfDir=tmp/vcf
if [ ! -e "$vcfDir" -a -e "$blastDir/vcf" ]
then
  vcfDir="$blastDir/vcf"
fi
# if $datasetIdDir may be "" then this condition is required.
if [ -z "$datasetIdDir" ]
then
  unused_var=${datasetIdDir:=$vcfDir/datasetId}
fi
set +x

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


logFile=vcfGenotypeLookup.log
(pwd; date; ) >> $logFile
echo $* >> $logFile

# (replace-regexp "\\(.+\\)" "\\1=$\\1,")
echo  \
 inContainer=$inContainer, \
 serverDir=$serverDir, \
 resourcesDir=$resourcesDir, \
 scriptsDir=$scriptsDir, \
 toolsDev=$toolsDev, \
 bcftools=$bcftools, \
 blastDir=$blastDir, \
 vcfDir=$vcfDir, \
 >> $logFile

# bcftools 'make install' installs by default in /usr/local/bin/
# (yum install is in /usr/bin/ - it is ancient : 0.1.17-dev (r973:277) and does not recognize 'query' command, so prefix with /usr/local/bin)
PATH=/usr/local/bin:${PATH}
echo  \
 PATH=$PATH, \
 >> $logFile



[ -d tmp ] || mkdir tmp

#-------------------------------------------------------------------------------

# Given the argumements to bcftools, other than $datasetIdParam, are in $*,
# extract the chromosome name, e.g. from "... chr1A ..." set chr="1A"
function chrFromArgs()
{
  # $* may be a multi-line string; only output the chr line.
  chr=$( echo "$*" | sed -n 's/\(chr..\).*/\1/;s/.*chr//p')
}

#-------------------------------------------------------------------------------



set -x
# If called directly from Node.js childProcess / spawn then fd 3,4 are
# defined for returning warnings, errors, respectively.
#
# If running from Node.js spawn (e.g. within container) then unused args fileName=$1 useFile=$2
# are passed.  If running from Flask server they are not passed.
if [ -e /proc/self/fd/3 ]
then
  fileName="$1"
  useFile="$2"
  shift 2
  echo fileName="$fileName", useFile=$useFile,   >> $logFile
fi

  command="$1"
  datasetIdParam="$2"
  scope="$3"
  isecFlags="$4"
  isecDatasetIds="$5"
  shift 5
  # Switch off logging for preArgs, which contains samples which may be a large list.
  set +x

  preArgsAll=("${@}")
  # split preArgsAll into 2 arrays : preArgs and paramsForQuery.
  # paramsForQuery is demarcated by -queryStart and -queryEnd.
  preArgs=(); paramsForQuery=(); inQuery=;
  for argVal in "${preArgsAll[@]}"; do
    case "$argVal" in
      -queryStart) inQuery='1';;
      -queryEnd)   inQuery=;;
      *) if [ -z "$inQuery" ] ;
         then preArgs+=("$argVal");
         else paramsForQuery+=("$argVal");
         fi
         ;;
    esac;
  done

  echo command="$command", datasetIdParam="$datasetIdParam", scope="$scope", \
       isecFlags="$isecFlags", isecDatasetIds="$isecDatasetIds",	\
       paramsForQuery="${paramsForQuery[@]}",	\
       preArgs="${preArgs[@]}"  >> $logFile

set -x


if [ -z "$scope" ]
then
  chrFromArgs "$*"
else
  chr=$scope
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
  # copied from dnaSequenceLookup.bash, this could be a VCF/TSV output.
  region=$1
  echo ">$region"
  echo "C"
}

#-------------------------------------------------------------------------------

# The given param $datasetIdParam is the data dataset not the reference;
# possibly both will be required.
# Sanitize datasetIdParam. Allow only alphanumeric and -._ and space.
datasetIdParam=$(echo "$datasetIdParam" | sed 's/[^-A-Za-z0-9._ ]/_/g')

# for dataset.tags.vcfDb : $vcfDir/datasetname/chrXX.vcf.gz, chrXX.vcf.gz.csi
# datasetname/ may be a symbolic link;
# If chrXX.vcf.gz.csi is not present it will be created using 'bcftools index'.
# It's name is derived from chrXX.vcf.gz by appending .csi,
# regardless of whether if chrXX.vcf.gz is a symbolic link

# not required for vcf : datasetId2dbName(), $datasetIdDir

# $datasetId is used via dbName2Vcf(), instead of $(datasetId2dbName ).


#-------------------------------------------------------------------------------

# Convert one datasetId to $vcfGz
# Echo $vcfGz to stdout
# @param dbName  datasetId
# @return status 0 if dbName dir has files $vcfGz and .csi, where vcfGz is $chr.vcf.gz
function dbName2Vcf() {
  dbName=$1
  datasetId=$dbName

  # (! does not preserve $?, so if that is required, if cd ... ; then : ; else status=$?; echo 1>&$F_ERR "..."; exit $status; fi;  , and equivalent for each if. )
  status=1
  # relative to $vcfDir/$dbName/
  # Some vcf files may have "chr" before $chr.
  # Raw .vcf.gz provided to Pretzel by the data administrator.
  # This may contain INFO/MAF, otherwise it will be added.
  vcfInputGz="$chr.vcf.gz"
  if ! cd "$vcfDir"
  then
    echo 1>&$F_ERR 'Error:' "VCF file is not configured"
  elif ! cd "$dbName"
  then
    echo 1>&$F_ERR 'Error:' "VCF dataset dir is not configured", "$datasetId"
  elif [ ! -f "$vcfInputGz" ]
    # $vcfInputGz may be a symbolic link here.
    # bash(1) " ... Except for -h and -L, all FILE-related tests dereference symbolic links."
  then
    echo 1>&$F_ERR 'Error:' "VCF file is not configured", "$datasetId", "$chr", "$vcfInputGz"
  else
    status=0
    # This file will have INFO/MAF.
    vcfGz=$(echo "$vcfInputGz" | sed 's/.vcf/.MAF.vcf/')
    # Use -e instead of -f, as $vcfInputGz could be a file or symbolic link.
    [ -e "$vcfGz" ] || make -f $serverDir/$scriptsDir/vcfGenotypeLookup.Makefile "$vcfGz"

    # If file does not have an index (.csi), create it.
    # Use -e instead of -f, as csi file could be a file or symbolic link.
    if [ ! -e "$vcfGz".csi ]
    then
      if ! bcftools index "$vcfGz"
      then
        status=$?
        echo 1>&$F_ERR 'Error:' "No index $vcfGz.csi, and failed to build index."
      fi
    fi
    if [ $status -eq 0 ]
    then
      echo "$dbName/$vcfGz"
    fi
  fi
  return $status
}

commonSNPsDir=region_common_SNPs
(cd $serverDir/"$vcfDir"; [ -d $commonSNPsDir ] || mkdir $commonSNPsDir )

# Use bcftools isec to prepare a list of common SNPs between $isecDatasetIds ($vcfGzs).
# Uses $vcfGzs, $isecFlags, $chr.
# Sets $commonSNPs
function prepareCommonSNPs() {
  # Until 7c5cabb3 commonSNPs file name was based on the combined names of the
  # datasets + chrs + isecFlags to be intersected, enabling caching of
  # intersection SNPs per-chromosome for each intersection of datasets.
  # This is changed to a single file name because :
  # -R overrides -r instead of intersect, so don't retain the intersection files /
  # common SNPs; overwrite the previous file, and intersect just the required region,
  # instead of the whole chromosome.
  # Including parameters in the file name to handle multiple concurrent calls,
  # e.g. triggered by a single client action (autoLookup)
  # $commonSNPsDir/
  commonSNPs="isec.$isecFlags.$chr.$isecDatasetIds.$$.vcf"
  if [ ${#vcfGzs[@]} -gt 0 ]
  then
    if true # [ ! -f "$commonSNPs" ]
    then
      if [ -z "$isecFlags" ]
      then
        isecFlags=-n=${#vcfGzs[@]}
        # commonSNPs="isec.$isecFlags.$chr.$isecDatasetIds.vcf"
      else
        # provide 0 return status
        true
      fi
      regionParams=($1 $2); shift 2;
      # This outputs this note : "Note: -w option not given, printing list of sites..."
      # The options suggested in this post :
      #   https://github.com/samtools/bcftools/issues/334#issuecomment-147310754
      # don't prevent the message; also tried without -o and -r.
      # The note does not cause a non-zero return status.
      2>&$F_ERR "$bcftools" isec $isecFlags -c all -o "$commonSNPs" "${regionParams[@]}" "${vcfGzs[@]}"  |& \
        fgrep -v "Note: -w option not given, printing list of sites..."
      return ${PIPESTATUS[0]}
    else
      true
    fi
  else
    true
  fi
}

# Execute the bcftools command $command, applied to $vcfGz, and using $commonSNPs if isecDatasetIdsArray is not empty, 
# and using params, which are of the form -r 1A:1188384-1191531
# @param command
# @param vcfGz
# @param ..."${preArgs[@]}", using only the initial regionParams
# Uses : "${preArgs[@]}" "${paramsForQuery[@]}" 
function bcftoolsCommand() {
  command="$1";   shift
  vcfGz="$1";     shift
  >> $serverDir/$logFile echo isecDatasetIdsArray : ${#isecDatasetIdsArray[@]} ${isecDatasetIdsArray[@]}, vcfGzs ${#vcfGzs[@]} ${vcfGzs[@]}
  # ${@} is ${preArgs[@]}; used this way it is split into words correctly - i.e. 
  # '%ID\t%POS\t%REF\t%ALT[\t%TGT]\n' is a single arg.
  if [ ${#isecDatasetIdsArray[@]} -gt 0 ]
  then
    # uses $vcfGzs.  $@ is preArgs, starting with "${regionParams[@]}"
    regionParams=($1 $2); shift 2;
    preArgs=("${preArgs[@]:2}")
    # Use absolute path for logFile because this is within cd ... "$vcfDir"
    >> $serverDir/$logFile echo regionParams="${regionParams[@]}", "${@}"
    if prepareCommonSNPs "${regionParams[@]}"
       then
    # -R, --regions-file
    if [ "$command" = query ]
    then
      # regionParams are used by prepareCommonSNPs and cannot be used with
      # -R "$commonSNPs", which incorporates them.
      2>&$F_ERR "$bcftools" view  -O v -R "$commonSNPs" "$vcfGz" "${preArgs[@]}" | \
        2>&$F_ERR "$bcftools" "$command" "${paramsForQuery[@]}"
    else
      2>&$F_ERR "$bcftools" view -O v -R "$commonSNPs" \
                "$vcfGz"
    fi
    fi
  else
    >> $serverDir/$logFile echo \#vcfGz ${#vcfGz}
    # Perhaps this check should be on ${#vcfGzs[@]}, but that is equal - seems it must be 0 at this point ?
    if [ ${#isecDatasetIdsArray[@]} -gt 1 ]
    then
      >> $serverDir/$logFile echo Expecting just 1 vcf.gz : ${#vcfGz}
    fi
    # Use SNPList if preArgs contains no samples, i.e. -S /dev/null
    # In this case view outputs on stderr : 'Warn: subsetting has removed all samples'
    # because the SNPList has 1 column and none are selected.  'query' does not output this warning.
    if [ "$command" = counts_query -o "$command" = counts_view ] || echo "${preArgs[@]}" | fgrep /dev/null >/dev/null 
    then
      if vcfGz_=$(ensureSNPList $vcfGz)
      then
        vcfGz="$vcfGz_"
      fi
      # SNPList=.SNPList
      command=$(echo "$command" | sed s/counts_//)
    fi

    # ${@} here is preArgs, starting with regionParams
    if [ "$command" = view_query ]
    then
      2>&$F_ERR "$bcftools" view  "$vcfGz"  "${regionParams[@]}"  "${preArgs[@]}" -Ou | \
        2>&$F_ERR "$bcftools" query "${paramsForQuery[@]}"
    else
      2>&$F_ERR "$bcftools" "$command" "$vcfGz" "${regionParams[@]}" "${preArgs[@]}" "${paramsForQuery[@]}"
    fi
  fi
}

#-------------------------------------------------------------------------------

# @param vcfGzSamples	1 vcfGz
ensureSNPList() {
  status=0
  vcfGzSamples="$1"
  vcfGzSNPList=$(echo "$vcfGzSamples" | sed s/.vcf.gz/.SNPList.vcf.gz/g )
  if [ ! -e "$vcfGzSNPList" ]
  then
    # only require information from cols 1-5, but VCF requires 1-9, i.e. including : QUAL FILTER INFO FORMAT
    # Seems that 1 sample column is required, so request 1-10
    zcat "$vcfGzSamples"  | cut -f1-10  | bgzip -c > "$vcfGzSNPList"
  fi
  if [ ! -e "$vcfGzSNPList".csi ]
  then
    # copied from dbName2Vcf()
    if ! bcftools index "$vcfGzSNPList"
    then
      status=$?
      # The GUI is likely to send 2 requests, which will cause the 2nd
      # 'bcftools index' to clash; message to stderr in server log is :
      #   index: the input is probably truncated, use -f to index anyway: 
      # Seems like the .csi is still OK.
      # Should probably either queue requests or create a lock file during index.
      # The plan is to normally use /api/Datasets/cacheblocksFeaturesCounts
      # which will send just 1 request.
      # If failed to build index, use the original .vcf.gz with all samples.
      vcfGzSNPList=
      echo 1>&$F_ERR 'Error:' "No index $vcfGzSNPList.csi, and failed to build index."
    fi
  fi
  echo -n $vcfGzSNPList
  return $status
}

#-------------------------------------------------------------------------------

# This directory check enables dev_result() for dev / loopback test, when blast is not installed.
if false && [ -d ../../pretzel.A1 ]
then
  # sleep 10
  dev_result "$region"
  status=$?
elif [ "$command" = status ]
then
  # cwd is $serverDir/
  if ! cd "$vcfDir"/"$datasetIdParam"
  then
    echo 1>&$F_ERR 'Error:' $? "VCF dataset dir is not configured", "$datasetIdParam", PWD=$PWD
  else
    ls -gGL | fgrep  .vcf.gz | cut -c13-
  fi
else
  vcfGz=$(dbName2Vcf "$datasetIdParam")

  # This string is joined with datasetIdsSeparator in vcf-genotype.js : vcfGenotypeLookup().
  isecDatasetIdsArray=($(echo "$isecDatasetIds" | tr '!' ' '))
  echo >> $logFile datasetIdParam="$datasetIdParam", isecDatasetIdsArray="${isecDatasetIdsArray[@]}"
  status=0
  # map from isecDatasetIdsArray to vcfGzs via dbName2Vcf;
  # i.e. isecDatasetIdsArray is parallel to vcfGzs.
  vcfGzs=()
  for datasetId in "${isecDatasetIdsArray[@]}"; do
    # result when break
    status=1
    vcfGzs+=( $(dbName2Vcf $datasetId || break) )
    cd $serverDir
    status=0
  done

  # later versions of bash : dbName2Vcf $di || break ... | readarray -t vcfGzs
  echo >> $logFile vcfGz="$vcfGz" vcfGzs="${vcfGzs[@]}"
  # vcfGzs[] includes datasetId/ for each dataset
  cd $serverDir/"$vcfDir"

  # if $vcfGz is empty then dbName2Vcf() has output an error.
    if [ $status -eq 0 -a -n "$vcfGz" ]
    then
      # ${@} corresponds to the parameter preArgs.
      # Switch off logging for ${@} - contains preArgs, which contains samples which may be a large list.
      # That won't be needed when preArgs.samples is output to a file, and -S (--samples-file) used instead.
      # see vcf-genotype.js : vcfGenotypeLookup() : preArgs.samples
      # set +x
      # some elements in preArgs may contain white-space, e.g. format "%ID\t%POS[\t%TGT]\n"
      if bcftoolsCommand "$command" "$vcfGz" "${preArgs[@]}" # uses ... "${preArgs[@]}" "${paramsForQuery[@]}"
      then
        status=$?	# 0
      else
        status=$?
        echo 1>&$F_ERR 'Error:' "Unable to run bcftools $command $datasetIdParam $scope $isecFlags $isecDatasetIds $commonSNPs $vcfGz ${preArgs[@]}"
        # Possibly transient failure because 1 request is doing isec
        # and another tries to read empty isec output.
        [ -n "$isecDatasetIds" ] && 1>&$F_ERR ls -gGd "$commonSNPs"
      fi
      set -x
    fi

fi

status_0=$?
[ -n "$commonSNPs" ] && ls -gG "$commonSNPs"	# rm

exit $status_0

#-------------------------------------------------------------------------------
