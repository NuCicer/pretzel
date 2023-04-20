import Component from '@glimmer/component';
import { computed } from '@ember/object';
import { alias, reads } from '@ember/object/computed';
import { later, /*once, bind,*/ debounce } from '@ember/runloop';
import { task, didCancel } from 'ember-concurrency';

import { keepLatestTask } from 'ember-concurrency-decorators';

/* global d3 */

import { eltIdFn } from '../../utils/draw/axis';

//------------------------------------------------------------------------------

const trace = 1;

const dLog = console.debug;

/** class name of the <g> containing the DOM SVG elements added by this component. */
const groupName = 'annotations';
/** class name of the <path> connecting the annotation text to the axis position it refers to.
 * The term arrow is used by analogy with tooltips which use an arrow to connect
 * their text to their target; at this stage the <path> is not decorated with an arrow.
 * Later on this component may add <text> <tspan> elements to contain text,
 * e.g. for labelling data Features on the axes.
 */
const arrowName = 'genotypeEdge';

const line = d3.line();

const arrowIdFn = eltIdFn('ar-', 'axisName');
/** d is axis1d */
function arrowKeyFn(d, i, g) {
  const key = arrowIdFn(d);
}



//------------------------------------------------------------------------------

export default class DrawGraphAnnotationsComponent extends Component {

  //----------------------------------------------------------------------------

  constructor() {
    super(...arguments);

    // used in development only, in Web Inspector console.
    if (window.PretzelFrontend) {
      window.PretzelFrontend.graphAnnotations = this;
    }

    this.initResizeListener();
  }

  //----------------------------------------------------------------------------

  @computed()
  get renderOnceFn () {
    return () => ! this.isDestroying && this.renderOnce();
  }

  renderOnce() {
    const
    fnName = 'renderOnce';
    dLog(fnName);
    {
      this.renderTask
        .perform()
        .catch((error) => {
          // Recognise if the given task error is a TaskCancelation.
          if (! didCancel(error)) {
            dLog(fnName, 'taskInstance.catch', error);
            throw error;
          } else {
          }
        });
    }
  }

  /** based on matrix-view.js : didRender(), renderOnceFn(), renderTask(), renderOnce().
   */
  @keepLatestTask
  renderTask = function *() {
    const fnName = 'renderTask';
    dLog(fnName);
    try {
      this.render();
    } catch(e) {
      dLog(fnName, 'error', e);
    } finally {
    }
  }

  //----------------------------------------------------------------------------

  render() {
    this.renderGroup();
  }

  renderGroup() {
    const
    fname = 'render',
    oa = this.args.stacksView.oa,
    svgContainer = oa.svgContainer,
    gS = svgContainer.selectAll('g.' + groupName)
      .data([groupName]), // datum could be used for class, etc
    gE = gS.enter()
      .append('g')
      .attr('class', groupName),
    gM = gE.merge(gS);
    this.selections = {gS, gE, gM};
    this.renderAnnotations();
    if (trace) {
      dLog(fname, gS.size(), gE.size(), gM.size(), gM.node());
    }
  }

  renderAnnotations() {
    const
    fname = 'renderAnnotations',
    selections = this.selections,
    oa = this.args.stacksView.oa,
    viewportWidth = oa.graphFrame.viewportWidth,
    tableX = viewportWidth,
    tableDim = this.tableYDimensions,
    tableRowInterval = tableDim && this.tableRowInterval(tableDim),
    axes = tableDim ? this.args.rightAxes || [] : [],
    stackLocation = this.axis1d?.location();
    if (selections) {
      const
      pS = selections.gS.selectAll('path.' + arrowName, arrowKeyFn)
        .data(axes),
      pE = pS.enter()
        .append('path')
        .attr('class', arrowName)
        .attr('id', arrowIdFn),
      pM = pE.merge(pS);
      pM.attr('d', axis1d => this.annotationPath(axis1d, tableX, tableRowInterval));
      if (trace) {
        dLog(fname, axes, viewportWidth, tableX, stackLocation, pS.nodes(), pE.nodes(), pM.node(), pM.nodes());
      }
    }
  }

  annotationPath(axis1d, tableX, tableRowInterval) {
    let lineText;
    /** related : utils/draw/path-data.js : featureLineS3(), patham2()  */
    const
    fname = 'annotationPath',
    tablePosition = axis1d.tablePosition,
    interval = tablePosition || axis1d.zoomedAndOrBrushedDomain,
      // .axisBrushObj.brushedDomain,
    yDomain = axis1d.currentPosition.yDomain;
    if (interval) {
      const
      /** Y scale for axis1d */
      y = axis1d.y,
      intervalPx = interval.map(y),
      tableIntervalPx = tableRowInterval || intervalPx,
      axisX = axis1d.location(),
      points = [
        [axisX, intervalPx[0]],
        [axisX, intervalPx[1]],
        [tableX, tableIntervalPx[1]],
        [tableX, tableIntervalPx[0]],
      ];
      lineText = line(points) + "Z";
      if (trace) {
        dLog(fname, intervalPx, interval, axisX, tablePosition, lineText);
      }
    }
    return lineText;
  }


  @computed(
    'axis1d',
    'axis1d.zoomed',
  )
  get renderEffect() {
    later(this.renderOnceFn, 200);
  }

  @computed(
    'axis1d.tablePosition',
    // .currentPosition.yDomain.{0,1}',	// Throttled
    'axis1d.zoomedAndOrBrushedDomain',
    'axis1d.zoomed', 'axis1d.extended', // 'axis1d.featureLength',
  )
  get zoomEffect() {
    this.renderAnnotations();
  }


  @alias('args.rightAxes.0') // 'stacksView.rightStack.axes[0]')
  axis1d;

  //----------------------------------------------------------------------------

  // @computed('stacksView.rightStack')
  get tablePositions() {
    const
    fname = 'tablePositions',
    stack = this.args.stacksView.rightStack,
    tablePositions = stack?.axes.map(axis1d => axis1d.tablePosition);
    dLog(fname, stack, tablePositions);
    return tablePositions;
  }

  /** Get the Y position of the top of the table, and its height. */
  get tableYDimensions() {
    let dim;
    const
    fname = 'tableYDimensions',
    tableDiv$ = $('div#observational-table.handsontable');
    if (tableDiv$.length) {
      const
      tableDiv = tableDiv$[0],
      offsetHeight = tableDiv.offsetHeight,// : 830
      offsetTop = tableDiv.offsetTop; // : 104
      dim = {offsetTop, offsetHeight};
      dLog(dim, tableDiv);
    }
    return dim;
  }

  tableRowInterval(tableDim) {
    const
    genotypeSettings = this.args.model.userSettings.genotype,
    /** 300 is default of defaultColumnHeaderHeight(); could use .colHeaderHeight. */
    columnHeaderHeight = genotypeSettings.columnHeaderHeight || 300,
    interval = ! tableDim ? undefined :
      [tableDim.offsetTop + columnHeaderHeight, tableDim.offsetHeight];
    return interval;
  }

  //----------------------------------------------------------------------------

  initResizeListener() {
    const elt = window; // '.draw-map-container > div#holder';
    d3.select(elt)
      .on('resize', () => { dLog('resize renderAnnotations'); ! this.isDestroying &&
                            debounce(this, this.renderAnnotations, 300); });
  }


  //----------------------------------------------------------------------------


}
