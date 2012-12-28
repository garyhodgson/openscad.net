define("Context", ["Globals", "openscad-parser-support"], function(Globals, OpenscadParserSupport){
    
    function Context(parentContext) {
        this.vars = {};
        this.parentContext = parentContext;
        this.inst_p;
        this.functions_p = {};
        this.modules_p = {};
        Globals.context_stack.push(this);
    };

    Context.prototype.setVariable = function(name, value) {
        if (value !== undefined){
            this.vars[name] = value;
        }
    };

    Context.prototype.args = function(argnames, argexpr, call_argnames, call_argvalues) {

        for (var i = 0; i < argnames.length; i++) {
            if (i < argexpr.length && argexpr[i] !== undefined){
                this.setVariable(argnames[i], argexpr[i].evaluate(this.parentContext));
            } else {
                this.setVariable(argnames[i], undefined);
            }
        };
        var posarg = 0;  
        for (var i = 0; i < call_argnames.length; i++) {
            if (call_argnames[i] === undefined) {
                if (posarg < argnames.length){
                    this.setVariable(argnames[posarg++], call_argvalues[i]);
                }
            } else {
                this.setVariable(call_argnames[i], call_argvalues[i]);
            }
        }
    };

    Context.prototype.lookupVariable = function(name) {

        if (_.has(this.vars, name)){
            return this.vars[name];
        }

        if (this.parentContext !== undefined){
            return this.parentContext.lookupVariable(name);
        }
        
        //console.log("WARNING: Ignoring unknown variable '"+name+"'.");    
        return undefined;
    };


    Context.prototype.evaluateFunction = function(name, argnames, argvalues) {

        if (_.has(this.functions_p, name)){
            return this.functions_p[name].evaluate(this, argnames, argvalues);
        }

        if (_.has(functionNameLookup, name)){
            return functionNameLookup[name].apply(this, argvalues);
        }

        if (this.parentContext !== undefined){
            return this.parentContext.evaluateFunction(name, argnames, argvalues);
        }
            
        console.log("WARNING: Ignoring unknown function '"+name+"'.");
        return undefined;
    };

    Context.prototype.evaluateModule = function(inst, factory) {

        var that = this;
    // this appears to double the argvalues when calling a submodule...
    //    _.each(inst.argexpr, function(expr,index,list) {
    //        inst.argvalues.push(expr.evaluate(that));
    //    });

        var customModule = _.find(this.modules_p, function(x) { return x.name == inst.name; });
        if (customModule !== undefined) {
            return customModule.evaluate(this, inst);
        }

        if (inst.isSubmodule === undefined || !inst.isSubmodule){
            var adaptor = factory.getAdaptor(inst);
            if (adaptor !== undefined){
                return adaptor.evaluate(this, inst);
            }
        }

        if (this.parentContext) {
            return this.parentContext.evaluateModule(inst, factory);
        }

        console.log("WARNING: Ignoring unknown module: " + inst.name);
        return undefined;
    };

    Context.newContext = function (parentContext, argnames, argexpr, inst) {
        var context = new Context(parentContext);
        context.args(argnames, argexpr, inst.argnames, inst.argvalues);
        return context;
    };

    Context.contextVariableLookup = function(context, name, defaultValue){
        var val = context.lookupVariable(name);
        if (val === undefined){
            val = defaultValue;
        }
        return val;
    }

    Context.printContext = function(c){
        console.log(c.vars);
        if (c.parentContext){
            Context.printContext(c.parentContext);
        }
    };

    /*
        Returns the number of subdivision of a whole circle, given radius and
        the three special variables $fn, $fs and $fa
    */
    Context.get_fragments_from_r = function(r, context) {
        var fn = Context.contextVariableLookup(context, "$fn", Globals.FN_DEFAULT);
        var fs = Context.contextVariableLookup(context, "$fs", Globals.FS_DEFAULT);
        var fa = Context.contextVariableLookup(context, "$fa", Globals.FA_DEFAULT);

        var GRID_FINE   = 0.000001;
        if (r < GRID_FINE) return 0;
        if (fn > 0.0)
            return parseInt(fn);
        return parseInt(Math.ceil(Math.max(Math.min(360.0 / fa, r*2*Math.PI / fs), 5)));
    };

    var functionNameLookup = {"cos":Math.cosdeg,"sin":Math.sindeg, "acos":Math.acosdeg,"asin":Math.asindeg,"atan":Math.atandeg,"atan2":Math.atan2deg,"tan":Math.tandeg,"max":Math.max,"min":Math.min, "ln":Math.log, 
        "len":function(val){
            var x = _.isString(val[0]) ? Globals.stripString(val[0]) : val[0];
            return x.length;
        },
        "log":function(){
            if (arguments[0].length == 2){
                return Math.log(arguments[0][1])/Math.log(arguments[0][0]);
            } else if (arguments[0].length == 1){
                return Math.log(arguments[0][0]);
            } else {
                return undefined;
            }
        },
        "str":function(){
            var vals = [];
            _.each(arguments[0], function(x){
                vals.push(Globals.convertForStrFunction(x));
            });

            return vals.join('');
        },
        "sign": function(val){
            return (val > 0)? 1.0 : ((val < 0)? -1.0 : 0);
        },
        "lookup": function(){
            var low_p, low_v, high_p, high_v;
            if (arguments.length < 2){
                logMessage("Lookup arguments are invalid. Incorrect parameter count. " +  arguments);
                return undefined;
            }

            var p = arguments[0];
            var vector = arguments[1];
            if (!_.isNumber(p)        ||      // First must be a number
                !_.isArray(vector)      ||      // Second must be a vector of vectors
                vector.length < 2       ||
                (vector.length >=2 && !_.isArray(vector[0]))
                ){
                logMessage("Lookup arguments are invalid. Incorrect parameters. " +  arguments);
                return undefined;
            }

            if (vector[0].length != 2){
                logMessage("Lookup arguments are invalid. First vector has incorrect number of values. " +  p + ",  " + vector);
                return undefined;
            }
            low_p = vector[0][0];
            low_v = vector[0][1];
            high_p = low_p;
            high_v = low_v;

            _.each(vector.slice(1), function(v){
                if (v.length == 2){
                    var this_p = v[0];
                    var this_v = v[1];

                    if (this_p <= p && (this_p > low_p || low_p > p)) {
                        low_p = this_p;
                        low_v = this_v;
                    }
                    if (this_p >= p && (this_p < high_p || high_p < p)) {
                        high_p = this_p;
                        high_v = this_v;
                    }
                }
            });

            if (p <= low_p){
                return low_v;
            }
                
            if (p >= high_p){
                return high_v;
            }

            var f = (p-low_p) / (high_p-low_p);
            return high_v * f + low_v * (1-f);
        }

    };

	return Context;
});