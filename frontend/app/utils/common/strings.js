/*----------------------------------------------------------------------------*/

/** Parse an optional url query param of this form :
 * alpha=a,split:11,dot=01,devel
 */
function parseOptions(options_param)
{
  let options = {};
  if (options_param)
  {
    options_param.split(',').reduce(function(result, opt) {
      /** Want to split(/[:=]/), but also sanitise the name and value, so just
       * split on any non-alphanumeric, so all punctuation is discarded. (allow '_')
       */
      let [name, val] = opt.split(/[^A-Za-z0-9_]/);
      let val_lower;
      /** treat options=name as options=name:true.
       * Recognise true and false, which will appear as strings 'true' and 'false'.
       * Convert a numeric argument from string to number.
       */
      if (val === undefined) {
        val = true;
      } else if ((val_lower = val.toLowerCase()) === 'false') {
        val = false;
      } else if (val_lower === 'true') {
        val = true;
      } else if (val.match(/[0-9.]/)) {
        val = +val;
      }
      result[name] = val;
      return result;
    }, options);
  }
  return options;
}

/*----------------------------------------------------------------------------*/

/** Convert a string to Boolean, e.g. 'false', 'true'.
 * @return true or false
 */
function toBool(x) {return (typeof x === "string") ? x.toLowerCase().trim() === "true" : x; };
// copied from backend/common/utilities/paths-aggr.js : pathsDirect()

/*----------------------------------------------------------------------------*/

export {
  parseOptions,
  toBool
};
