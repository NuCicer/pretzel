import { get as Ember_get, set as Ember_set } from '@ember/object';
import { A as Ember_A } from '@ember/array';


// -----------------------------------------------------------------------------

const dLog = console.debug;

const trace = 1;

const featureSymbol = Symbol.for('feature');

/** number of columns in the vcf output before the first sample column. */
const nColumnsBeforeSamples = 9;

/** map from vcf column name to Feature field name.
 */
const vcfColumn2Feature = {
  'CHROM' : 'blockId',
  'POS' : 'value',
  'ID' : '_name',
  'REF' : 'values.ref',
  'ALT' : 'values.alt',
};

// -----------------------------------------------------------------------------

/* sample data :

 * -------------------------------------
 * default output format :

##fileformat=VCFv4.1
##FILTER=<ID=PASS,Description="All filters passed">
##phasing=none
##INFO=<ID=NS,Number=1,Type=Integer,Description="Number of Samples With Data">

##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype as 0/1">

#CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO	FORMAT	ExomeCapture-DAS5-003227	ExomeCapture-DAS5-002775	ExomeCapture-DAS5-002986
chr1A	327382120	scaffold22435_31704476	G	A	100	PASS	AC=3;AN=6;NS=616;MAF=0.418019;AC_Het=233;tSNP=.;pass=no;passRelaxed=no;selected=no	GT:GL:DP	1/0:-7.65918,-2.74391e-08,-7.48455:6	1/0:-5.41078,-0.00397816,-2.1981:3	1/0:-4.50477,-1.46346e-05,-10.5809:6

 * -------------------------------------
 * requestFormat === 'CATG' : formatArgs = '-H  -f "%ID\t%POS[\t%TGT]\n"' :

# [1]ID	[2]POS	[3]ExomeCapture-DAS5-002978:GT	[4]ExomeCapture-DAS5-003024:GT	[5]ExomeCapture-DAS5-003047:GT	[6]ExomeC
scaffold38755_709316	709316	C/C	C/T	C/C	C/C	C/C	./.	C/C	C/C	C/C	C/T	C/C	C/C	C/C	C/C	C/T	C/C	C/C	C/C	C/C	C/T	C/C	C/C	C

 * -------------------------------------
 * requestFormat === 'Numerical' : formatArgs = '-H  -f "%ID\t%POS[\t%GT]\n"' :

# [1]ID	[2]POS	[3]ExomeCapture-DAS5-002978:GT	[4]ExomeCapture-DAS5-003024:GT	[5]ExomeCapture-DAS5-003047:GT	[6]ExomeC
scaffold38755_709316	709316	0/0	0/1	0/0	0/0	0/0	./.	0/0	0/0	0/0	0/1	0/0	0/0	0/0	0/0	0/1	0/0	0/0	0/0	0/0	0/1	0/0	0/0	0


*/




/** Parse VCF output and add features to block.
 * @return
 *  { createdFeatures : array of created Features,
 *    sampleNames : array of sample names }
 *
 * @param block view dataset block for corresponding scope (chromosome)
 * @param requestFormat 'CATG', 'Numerical', ...
 * @param replaceResults  true means remove previous results for this block from block.features[] and selectedFeatures.
 * @param selectedFeatures  updated directly - can change to use updatedSelectedFeatures
 * @param text result from bcftools request
 */
function addFeaturesJson(block, requestFormat, replaceResults, selectedFeatures, text) {
  const fnName = 'addFeaturesJson';
  dLog(fnName, block.id, block.mapName, text.length);
  /** optional : add fileformat, FILTER, phasing, INFO, FORMAT to block meta
   * read #CHROM or '# [1]ID' column headers as feature field names
   * parse /^[^#]/ (chr) lines into features, add to block
   */
  let
  createdFeatures = [],
  /** The same features as createdFeatures[], in selectedFeatures format. */
  selectionFeatures = [],
  /** if the output is truncated by rowLimit aka nLines, the last line will not
   * have a trailing \n, and is discarded.
   * Otherwise values.length may be < 4, and feature.value may be undefined.
   */
  lines = text.split('\n'),
  meta = {},
  /** true if column is genotype format value. */
  columnIsGT,
  columnNames,
  sampleNames,
  nFeatures = 0;
  dLog(fnName, lines.length);
  if (text && text.length && (text.charAt(text.length-1) === '\n')) {
    dLog(fnName, 'discarding', lines[lines.length-1]);
    lines.splice(-1, 1);
  }

  if (replaceResults) {
    let mapChrName = Ember_get(block, 'brushName');
    /* remove features of block from createdFeatures, i.e. matching Chromosome : mapChrName
     * If the user has renewed the axis brush, then selectedFeatures will not
     * contain any features from selectionFeature in previous result; in that
     * case this has no effect and none is required.
     * If the user send a new request with e.g. changed samples, then this would apply.
     */
    let blockSelectedFeatures = selectedFeatures.filter((f) => f.feature.get('blockId.id') === block.id);
    if (blockSelectedFeatures.length) {
      selectedFeatures.removeObjects(blockSelectedFeatures);
    }

    if (block.get('features.length')) {
      // alternative : block.set('features', Ember_A());
      block.features.removeAt(0, block.get('features.length'));
    }
  }

  lines.forEach((l, lineNum) => {
    if (l.startsWith('##')) {
      const nameVal = l.match(/^##([^=]+)=(.*)/);
      if (nameVal.length > 2) {
        /** ##INFO and ##FORMAT are duplicated : could .match(/.*ID=(.+),(.+)>/) and use ID to store [2] in meta.{INFO,FORMAT}.<ID>
         * ##bcftools_{viewVersion,viewCommand} are also duplicated, the last pair generated this output so it is of more interest.
         */
        meta[nameVal[1]] = nameVal[2];
      }
    } else if (l.startsWith('#CHROM')) {
      columnNames = l.slice(1).split('\t');
      sampleNames = columnNames.slice(nColumnsBeforeSamples);
    } else if (l.startsWith('# [1]ID')) {
      // # [1]ID	[2]POS	[3]ExomeCapture-DAS5-002978:GT	[4]ExomeCapture-DAS5-003024:GT	[5]ExomeCapture-DAS5-003047:GT	[6]ExomeC
      // trim off :GT, and split at 'tab[num]'
      columnIsGT = l
        .split(/\t\[[0-9]+\]/)
        .map((name) => name.endsWith(':GT'));
      columnNames = l
        .replaceAll(':GT', '')
        .split(/\t\[[0-9]+\]/);
      columnNames[0] = columnNames[0].replace(/^# \[1\]/, '');
      // nColumnsBeforeSamples is 2 in this case : skip ID, POS.
      sampleNames = columnNames.slice(2);
    } else if (columnNames && l.length) {
      const values = l.split('\t');

      let feature = values.reduce((f, value, i) => {
        const fieldName = columnNames[i];

        let fieldNameF;
        // overridden in the switch default.
        fieldNameF = vcfColumn2Feature[fieldName];
        /** maybe handle samples differently, e.g. Feature.values.samples: []
         * if (i > nColumnsBeforeSamples) { ... } else
         */
        switch (fieldName) {
        case 'CHROM' :
          let scope = value.replace(/^chr/, '');
          if (scope !== block.scope) {
            dLog(fnName, value, scope, block.scope, fieldName, i);
            value = null;
          } else {
            value = block;
          }
          break;

        case 'POS' :
          value = [ +value ];
          f['value_0'] = value;
          break;

        case 'ID' :
        case 'REF' :
        case 'ALT' :
          break;

        default :
          fieldNameF = 'values.' + fieldName;
        }
        if (! fieldNameF) {
          dLog(fnName, fieldName, value, i);
        } else {
          /** match values. and meta.  */
          let prefix = fieldNameF.match(/^(.+)\..*/);
          prefix = prefix && prefix[1];
          if (prefix) {
            /** replace A/A with A */
            if (columnIsGT[i]) {
              let match = value.match(/^(\w)[|/](\w)$/);
              if (match && (match[1] === match[2])) {
                value = match[1];
              }
            }
            if (! f[prefix]) {
              f[prefix] = {};
            }
            /* could use Ember_set() for both cases. */
            Ember_set(f, fieldNameF, value);
          } else {
            f[fieldNameF] = value;
          }
        }
        return f;
      }, {});
      // or EmberObject.create({value : []});

      /* CHROM column is present in default format, and omitted when -f is used
       * i.e. 'CATG', 'Numerical', so in this case set .blockId here. */
      if (requestFormat) {
        feature.blockId = block;
      }

      /** based on similar : components/table-brushed.js : afterPaste()  */

      /** If it is required for vcfFeatures2MatrixView() to create displayData
       * without creating model:Feature in the Ember data store, the following
       * part can factor out as a separate function, returning an array of of
       * native JS objects at this point, and passing those to the 2nd function
       * for creation of model:Feature
       */
      if (feature.blockId && feature.value?.length && feature._name) {
        // trace level is e.g. 0,1,2,3; the number of rows displayed will be e.g. 0,2,4,8.
        if (trace && (lineNum < (1 << trace))) {
          dLog(fnName, 'newFeature', feature);
        }

        // in this case feature.blockId is block
        let store = feature.blockId.get('store');

        // .id is used by axisFeatureCircles_eltId().
        // ._name may be also added to other blocks.
        feature.id = block.id + '_' + feature._name;
        let existingFeature = store.peekRecord('Feature', feature.id);
        if (existingFeature) {
          mergeFeatureValues(existingFeature, feature);
          feature = existingFeature;
          // this is included in createdFeatures, since it is a result from the current request.
        } else {
          // Replace Ember.Object() with models/feature.
          feature = store.createRecord('Feature', feature);
          /** fb is a Proxy */
          let fb = feature.get('blockId');
          if (fb.then) {
            fb.then((b) => feature.set('blockId', b));
          }
        }
        nFeatures++;

        let mapChrName = Ember_get(feature, 'blockId.brushName');
        let selectionFeature = {Chromosome : mapChrName, Feature : feature.name, Position : feature.value[0], feature};

        createdFeatures.push(feature);
        selectionFeatures.push(selectionFeature);
        block.features.addObject(feature);
      }

    }
  });
  selectedFeatures.pushObjects(selectionFeatures);

  if (! columnNames || ! sampleNames) {
    dLog(fnName, lines.length, text.length);
  }

  let result = {createdFeatures, sampleNames};
  return result;
}

// -----------------------------------------------------------------------------

/** Merge feature.values into existingFeature.values
 */
function mergeFeatureValues(existingFeature, feature) {
  Object.entries(feature.values).forEach((e) => {
    if (existingFeature.values[e[0]] !== e[1]) {
      console.log(feature.id, existingFeature.values[e[0]] ? 'setting' : 'adding', e);
      existingFeature.values[e[0]] = e[1];
    }
  });
}

// -----------------------------------------------------------------------------

function matchExtract(string, regexp, valueIndex) {
  let match = string.match(regexp),
      value = match && match[valueIndex];
  return value;
}

/** Map the result of vcfGenotypeLookup() to the format expected by component:matrix-view param displayData
 *  columns [] -> {features -> [{name, value}...],  datasetId.id, name }
 *
 * Originally block was a param, but now it is derived from features, because
 * there may be features of multiple blocks.
 *
 * @param requestFormat 'CATG', 'Numerical', ...
 * @param added
 *  { createdFeatures : array of created Features,
 *    sampleNames : array of sample names }
 *
 * @return displayData
 */
function vcfFeatures2MatrixView(requestFormat, added) {
  const fnName = 'vcfFeatures2MatrixView';
  /** createdFeatures : array of model:Feature (could be native JS objects - see
   * comment in addFeaturesJson() */
  let {createdFeatures, sampleNames} = added;
  /** The param added.createdFeatures could be grouped by block.
   * Ordering by sampleName seems more useful, although not clear how often sampleName appears in 2 blocks.
   */
  const blocks = createdFeatures.reduce((result, feature) => {
    result.set(feature.get('blockId.content'), true);
    return result;
  }, new Map());

  let displayData = sampleNames.reduce((result, sampleName) => {
    /** if any features of a block contain sampleName, then generate a
     * block:sampleName column, with all features of all blocks, in
     * feature.value[0] order - empty where block has no feature.
     */
    for (const block of blocks.keys()) {
      /** blocks : features : samples
       * maybe filter by sampleName.
       * each column is identified by block + sampleName, and has features of that block with that sampleName
       */
      let
      featuresMatchSample = 0,
      /** could map block to an array of samples which its features have, enabling
       * column order by block. */
      // sort features by .value[0]
      features = createdFeatures.map((f) => {
        let
        sampleValue = Ember_get(f, 'values.' + sampleName),
        value = requestFormat ? sampleValue : matchExtract(sampleValue, /^([^:]+):/, 1),
        name = f.get('blockId.brushName') + ' ' + f.name,
        fx = {name, value};
        if ((f.get('blockId.id') === block.get('id')) && (sampleValue !== undefined)) {
          featuresMatchSample++;
        }
        fx[featureSymbol] = f;
        return fx;
      });
      if (featuresMatchSample) {
        let
        datasetId = block ? Ember_get(block, 'datasetId.id') : '',
        name = (block ? Ember_get(block, 'name') + ' ' : '') + sampleName,
        column = {features,  datasetId : {id : datasetId}, name};
        result.push(column);
      }
    };
    return result;
  }, []);
  dLog(fnName, displayData);
  return displayData;
}

// -----------------------------------------------------------------------------


export { addFeaturesJson, vcfFeatures2MatrixView };
