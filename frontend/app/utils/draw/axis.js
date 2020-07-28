/*----------------------------------------------------------------------------*/

/*global d3 */

/*----------------------------------------------------------------------------*/

const trace_axis = 0;
const dLog = console.debug;

/*----------------------------------------------------------------------------*/

var oa;

function Axes(oa_)
{
  oa = oa_;
};

/*----------------------------------------------------------------------------*/
// moved here from draw-map.js

/** @param domain [min,max], e.g. result of d3.extent()
 * @return if flipped, [max,min]
 */
function maybeFlip(domain, flipped)
{
  return flipped
    ? [domain[1], domain[0]]
    : domain;
}
/** @param extent [[left,top],[right,bottom]], e.g. [[-8,0],[8,myRange]].
 * @return if flipped, [[left,bottom],[right,top]] */
function maybeFlipExtent(extent, flipped)
{
  return flipped
    ? [[extent[0][0], extent[1][1]], [extent[1][0], extent[0][1]]]
    : extent;
}

/*----------------------------------------------------------------------------*/

/** @return true if domain is undefined or [false, false] or [0, 0].
 */
function noDomain(domain) {
  let noDomain = ! domain || ! domain.length ||
    ((domain.length == 2) && ! domain[0] && ! domain[1]);
  return noDomain;
}

/*----------------------------------------------------------------------------*/

/** Check that y axis scale yp.domain() is initialised, and if not,
 * define it from .featureLimits of first block of axis
 *
 * axis-1d : domainChanged()->updateScaleDomain() can handle this, but perhaps
 * that needs an added dependency.
 *
 * @param axis  e.g. oa.axes[brushedAxisID]
*/
function ensureYscaleDomain(yp, axis) {
  if (! yp.domain().length) {
    let block0 = axis && axis.blocks.length && axis.blocks[0],
    block0featureLimits = block0 && block0.block && block0.block.featureLimits;
    if (block0featureLimits) {
      // for GM, blocks[0] has .featureLimits and not .range
      dLog('block0featureLimits', block0featureLimits, axis.axisName, block0.longName());
      yp.domain(block0featureLimits);
    }
  }
}

/*----------------------------------------------------------------------------*/

/** For <text> within a g.axis-outer, counteract the effect of g.axis-outer scale() which
 * is based on axis.portion.
 *
 * Used for :
 *  g.axis-outer > g.axis > g.tick > text
 *  g.axis-outer > g.axis > g.btn     (see following yAxisBtnScale() )
 *  g.axis-outer > g.axis > text
 * g.axis has the axisName in its name (prefixed via axisEltId()) and in its .__data__.
 * The axis / axis title (g.axis > text) has axisName in its name, .__data__, and parent's name
 * (i.e. g[i].__data__ === axisName)
 *
 * g.tick already has a transform, so place the scale transform on g.tick > text.
 * g.btn contains <rect> and <text>, both requiring this scale.
 *
 */
function yAxisTextScale(/*d, i, g*/)
{
  let
    axisName = this.__data__,
  axis = oa.axes[axisName],
  portion = axis && axis.portion || 1,
  scaleText = "scale(1, " + 1 / portion + ")";
  // console.log("yAxisTextScale", d, i, g, this, axisName, axis, portion, scaleText);
  return scaleText;
}
function yAxisTicksScale(/*d, i, g*/)
{
  let parent = this.parentElement,
  gp = parent.parentElement,
  // could update arguments[0] = gp.__data__, then yAxisTextScale() can use d
  scaleText = yAxisTextScale.apply(gp, arguments);
  return scaleText;
}
/**
 * @param gAxis has __data__ which is axisName; may be g.axis-all or g.btn
 */
function axisExtended(gAxis)
{
  let
  axisName = gAxis.__data__,
  axis = oa.axes[axisName],
  extended = axis.extended; // or axis.axis1d.get('extended'),
  /* .extended should be false or width;  if it is just true then return the default initial width. */
  if (extended === true)
    extended = 130;
  return extended;
}
/** @return transform for the Zoom / Reset button which is currently near the axis title.
 * @description
 * Usage : ... .selectAll('g.axis ... g.btn > text').attr("transform", yAxisBtnScale);
 * @param d axisName
 */
function yAxisBtnScale(d/*, i, g*/)
{
  let g = this.parentElement,
  axisName = d, // === g.__data__
  extended = axisExtended(g),
  /** If extended, the Zoom button is overlain by the split axis rectangle, so shift it up. */
  yOffsetText = extended ? ',-40' : '';
  console.log('yAxisBtnScale', g, axisName, yOffsetText);
  return 'translate(10'+yOffsetText+') ' + yAxisTextScale.apply(this, arguments);
}
/** @return transform for the axis title
 * @description
 * Usage : ... .selectAll("g.axis-all > text")
 * .attr("transform", yAxisTitleTransform(oa.axisTitleLayout))
 * @param d axisName
 */
function yAxisTitleTransform(axisTitleLayout)
{
  return function (d /*, i, g*/) {
    // order : scale then rotate then translate.
    let 
      gAxis = this.parentElement,
    axisName = d, // === gAxis.__data__
    axis = oa.axes[axisName],
    width = axisExtended(gAxis),
    /** true if axis is at top of its stack. */
    top = axis.stack.axes[0] === axis,
    /** See also setWidth() which sets the same translate, initially. */
    translateText = top && width ? " translate(" + width/2 + ",0)" : '';
    if (trace_axis)
      console.log('yAxisTitleTransform', arguments, this, gAxis, axisName, axis, width, translateText);
    return yAxisTextScale.apply(this, arguments) + ' ' + axisTitleLayout.transform()
      + translateText;
  };
}

/*----------------------------------------------------------------------------*/

/** Used for group element, class "axis-outer"; required because id may start with
 * numeric mongodb id (of geneticmap) and element id cannot start with
 * numeric.
 * Also used for g.stack, which is given a numeric id (@see nextStackID).
 * Not used for axis element ids; they have an "f" prefix.
 */
function eltId(name)
{
  return "id" + name;
}
/** id of axis g element, based on axisName, with an "a" prefix. */
function axisEltId(name)
{
  return "a" + name;
}
/** id of g.axis-all element, based on axisName, with an "all" prefix. */
function eltIdAll(d) { return "all" + d; }
/** id of <g clippath> element, based on axisName, with an "axis-clip" prefix. */
function axisEltIdClipPath(d) { return "axis-clip" + d; }

/** id of highlightFeature div element, based on feature name, with an "h" prefix. */
function highlightId(name)
{
  return "h" + name;
}

/** prefix for id of a g.tracks.  Used within split axis. see components/axis-tracks.js  */
const trackBlockEltIdPrefix = 'tb-';

/*----------------------------------------------------------------------------*/

/** Used to colour the blocks within an axis distinctly;
 * Originally was using blockId as index, but now using index within axis.blocks[].
 * The same colours are re-used on each axis.
 */
const
axisTitleColourKey = { index: 1, value : 2, slot : 3},
axisTitleColourBy = axisTitleColourKey.slot;
let
  axisTitle_colour_scale = (axisTitleColourBy === axisTitleColourKey.value) ?
  d3.scaleOrdinal().range(d3.schemeCategory10) :
  d3.scaleSequential().domain([1,11]).interpolator(d3.interpolateRainbow);


/** for the stroke and fill of axis title menu
 *
 * parameters match d3 call signature, but now this is wrapped by
 * Block.prototype.axisTitleColour() and Block.axisTitleColour(), which is
 * called from d3.
 *
 * @param d block (g.axis-all > text > tspan) or blockId (g.axis-use > g.tracks)
 * @param i index of element within group.  i===0 is the reference block, which has colour undefined; data blocks have i>0
 * @param group
 */
function axisTitleColour (d, i) {
  /** blockId can be used as the ordinal value, e.g. let blockId = (d.axisName || d);
   * This results in unique colours for each block; we decided instead to re-use
   * the same set of colours on each axis.
   */
  let value;
  switch (axisTitleColourBy)  {
  case axisTitleColourKey.index :
    value = (i == 0) ? undefined : i;
    break;
  case axisTitleColourKey.value :
    value = d;
    break;
  case axisTitleColourKey.slot :
    /** d is axisName / blockId */
    let
    blockS = oa.stacks.axes[d],
    block = blockS && blockS.block,
    axis = blockS && blockS.axis, // if reference then === oa.axes[d],
    axis1d = axis && axis.axis1d;
    value = axis1d && axis1d.blockColour(block);
    if (trace_axis > 1)
      dLog('axisTitleColour', d, i, axis, block, axis1d, value);
    if (value === -1)
      value = undefined;
    break;
 };
  let
    colour = (value === undefined) ? undefined : axisTitle_colour_scale(value);
  return colour;
};

/*----------------------------------------------------------------------------*/

export {
  Axes, maybeFlip, maybeFlipExtent, noDomain,
  ensureYscaleDomain,
  yAxisTextScale,  yAxisTicksScale,  yAxisBtnScale, yAxisTitleTransform, eltId, axisEltId, eltIdAll, axisEltIdClipPath, highlightId,
  trackBlockEltIdPrefix,
  axisTitleColour
};
