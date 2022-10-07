import { axisFeatureCircles_selectOneInAxis } from '../draw/axis';

/* global d3 */

/*----------------------------------------------------------------------------*/

const featureSymbol = Symbol.for('feature');

// const trace = 0;
const dLog = console.debug;

/*----------------------------------------------------------------------------*/

/** Alternative to featureSymbol for string values, which can't have [Symbol].
 * Store a mapping from string to Feature.
 */
let stringsToFeatures = {};
function stringGetFeature(sampleValue) {
  return stringsToFeatures[sampleValue];
}
/**
 * @return sampleValue, so that this can be used in a value pipeline
 */
function stringSetFeature(sampleValue, feature) {
  stringsToFeatures[sampleValue] = feature;
  return sampleValue;
}


/*----------------------------------------------------------------------------*/

/** Assign Feature reference to each row. */
function setRowAttributes(table, data, dataIsRows) {
  /** genotype data is samples[], and contains samples[i].features
   * These 2 uses should fall into alignment as the genotype table requirements evolve.
   */
  const dataIsColumns = ! dataIsRows && data.length && Array.isArray(data[0].features);
  if (dataIsColumns) {
    data = data[0].features;
  } else if (dataIsRows) {
    /* displayDataRows is a sparse array, indexed by Position (value.0)
     * Object.values() returns the non-empty values, which will correspond to the table rows.
     */
    data = Object.values(data);
  }
  // expect that data.length matches  table.countRows()
  data.forEach((feature, physicalRow) => {
    const row = table.toVisualRow(physicalRow);
    if (row === null) {
    } else
    if (dataIsColumns) {
      feature = feature[featureSymbol];

      setRowAttribute(table, row, /*col*/undefined, feature);
    } else if (dataIsRows) {
      Object.values(feature).forEach((value, physicalcol) => {
        const col = table.toVisualColumn(physicalCol);
        if (col !== null) {
          const feature = value[featureSymbol] || stringGetFeature(value);
          setRowAttribute(table, row, col, feature);
        }
      });
    }
  });
}
/**
 * @param row visualRowIndex
 * @param col visualColIndex
 */
function setRowAttribute(table, row, col, feature) {
  /* original table-brushed.js setRowAttributes() used .setRowAttribute(),
   * which used tr.__dataPretzelFeature__; CellMeta seems better.
   * This will transition to use Symbol.for('feature') once all uses are going via this function.
   */
  if (getRowAttribute(table, row, col) !== feature) {
    table.setCellMeta(row, col || 0, 'PretzelFeature', feature);
  }
}
/**
 * @param row visualRowIndex
 * @param col visualColIndex
 */
function getRowAttribute(table, row, col) {
  const fnName = 'getRowAttribute';
  /** The feature reference is constant for the row, and is only stored on col 0
   * (except for setRowAttributes() : dataIsRows), but may have to store on all
   * columns because for wide tables physical col 0 may have visual col null.
   */
  if (col === undefined) {
    col = table.toVisualColumn(/*physical col*/0);
    if (col === null) {
      dLog(fnName, 'col 0 -> null', table.countRows(), table.countCols());
    }
  }
  const
  feature = (col === null) ? undefined : table.getCellMeta(row, col)?.PretzelFeature;;
  return feature;
}


/*----------------------------------------------------------------------------*/

/** table is passed as `this` to afterOnCellMouseOver(), so the surrounding
 * closure is not needed (unless a reference to the parent component becomes
 * required).
 */
function afterOnCellMouseOverClosure(hasTable) {
  /**
   * @param coords 	CellCoords 	Hovered cell's visual coordinate object.
   * refn : https://handsontable.com/docs/javascript-data-grid/api/hooks/#afteroncellmouseover
   */
  function afterOnCellMouseOver(event, coords, TD) {
    let
    table = hasTable.table, // === this
    feature = tableCoordsToFeature(table, coords);
    dLog('afterOnCellMouseOver', coords, TD, feature?.name, feature?.value);
    /** clears any previous highlights if feature is undefined */
    highlightFeature(feature);
  }
  return afterOnCellMouseOver;
}

/**
 * @param table HandsOnTable
 * @param coords {row, col}  as passed to afterOnCellMouseDown
 *  coords 	CellCoords 	Hovered cell's visual coordinate object.
 * @return feature, or undefined if (coords.row === -1)
 */
function tableCoordsToFeature(table, coords) {
  let feature;

  if (coords.row === -1) {
    /* this may be ^A (Select All), or click outside, or click in header row.
     * No feature associated with those so return undefined.
     */
  } else {
    // getDataAtCell(coords.row, coords.col)
    // table?.getDataAtRow(coords.row);

    /** The meta is associated with column 0.
     * The data is currently the selected feature, which refers to the Ember
     * data object as .feature
     * coords.{row,col} are visual indexes, as required by getRowAttribute().
     */
    feature = table && getRowAttribute(table, coords.row, /*col*/undefined);
    /*  for dataIsColumns (manage-genotype / matrix-view), this is the Ember
     *  data model feature object; for table-brushed this is the selection
     *  feature, which has attribute .feature which is the Ember object.
     */
    if (feature?.feature) {
      feature = feature.feature;
    }
  }

  return feature;
}


/** @param feature may be name of one feature, or an array of features -
 * selectedFeatures data : {
 *   Chromosome: string : datasetId ':' block name (scope)
 *   Feature: string : feature name
 *   Position: number
 *   feature: ember-data object
 * }
 */
function highlightFeature(feature) {
  const fnName = 'highlightFeature';
  d3.selectAll("g.axis-outer > circle")
    .attr("r", 2)
    .style("fill", "red")
    .style("stroke", "red");
  if (feature) {
    if (Array.isArray(feature)) {
      feature.forEach(
        (f, i) => f ? highlightFeature1(f.feature) : dLog(fnName, f, i, feature));
    } else {
      highlightFeature1(feature);
    }
  }
};

/** Highlight 1 feature, given feature */
function highlightFeature1(feature) {
  /** see also handleFeatureCircleMouseOver(). */
  axisFeatureCircles_selectOneInAxis(undefined, feature)
    .attr("r", 5)
    .style("fill", "yellow")
    .style("stroke", "black")
    .moveToFront();
};

d3.selection.prototype.moveToFront = function() {
  return this.each(function(){
    this.parentNode.appendChild(this);
  });
};


export {
  stringGetFeature,
  stringSetFeature,
  setRowAttributes,
  setRowAttribute,
  getRowAttribute,
  afterOnCellMouseOverClosure,
  tableCoordsToFeature,
  highlightFeature1,
  highlightFeature,
};
