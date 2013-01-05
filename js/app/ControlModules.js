define("ControlModules", ["Globals", "Context", "Range"], function(Globals, Context, Range){

	function ControlModule(factory){
        this.factory = factory;
    };
    
    function IfStatement(a){
        ControlModule.call(this, a);
    };

    IfStatement.prototype.evaluate = function(parentContext, inst){
        inst.argvalues = [];

        _.each(inst.argexpr, function(expr,index,list) {
            inst.argvalues.push(expr.evaluate(parentContext));
        });

        var context = Context.newContext(parentContext, [], [], inst);

        var childrenToEvaluate = (inst.argvalues.length > 0 && inst.argvalues[0])? inst.children : inst.else_children;

        var childModules = [];

        for (var i = 0; i < childrenToEvaluate.length; i++) {

            var childInst = childrenToEvaluate[i];

            childInst.argvalues = [];

            _.each(childInst.argexpr, function(expr,index,list) {
                childInst.argvalues.push(expr.evaluate(context));
            });

            var childAdaptor = this.factory.getAdaptor(childInst);

            childModules.push(childAdaptor.evaluate(context, childInst));
        };
        if (_.isEmpty(childModules)){
            return undefined;
        } else {
            return childModules;
        }
    };

    function ForLoopStatement(factory, args){
        ControlModule.call(this, factory);
        this.csgOp = args.csgOp;

        this.forEval = function(parentEvaluatedChildren, inst, recurs_length, call_argnames, call_argvalues, arg_context)
        {
            evaluatedChildren = parentEvaluatedChildren;

            if (call_argnames.length > recurs_length) {
                var it_name = call_argnames[recurs_length];
                var it_values = call_argvalues[recurs_length];
                var context = new Context(arg_context);
            
                if (it_values instanceof Range) {
                    var range = it_values;
                    if (range.end < range.begin) {
                        var t = range.begin;
                        range.begin = range.end;
                        range.end = t;
                    }
                    if (range.step > 0 && (range.begin-range.end)/range.step < 10000) {
                        for (var i = range.begin; i <= range.end; i += range.step) {
                            context.setVariable(it_name, i);
                            this.forEval(evaluatedChildren, inst, recurs_length+1, call_argnames, call_argvalues, context);
                        }
                    }
                }
                else if (_.isArray(it_values)) {
                    for (var i = 0; i < it_values.length; i++) {
                        context.setVariable(it_name, it_values[i]);
                        this.forEval(evaluatedChildren, inst, recurs_length+1, call_argnames, call_argvalues, context);
                    }
                }
            } else if (recurs_length > 0) {
                evaluatedChildren = _.union(evaluatedChildren, inst.evaluateChildren(arg_context));
            }

            if (_.isArray(evaluatedChildren)){
                // remove empty arrays (e.g. for loops containing only echo statements)
                evaluatedChildren = _.reject(evaluatedChildren, function(x){ return _.isEmpty(x); });
            }

            // Note: we union here so subsequent actions (e.g. translate) can be performed on the entire result of the for loop.
            if (_.isArray(evaluatedChildren) && evaluatedChildren.length > 1){
                var unionedEvaluatedChildren = _.first(evaluatedChildren)+"."+this.csgOp+"([" + _.rest(evaluatedChildren) + "])";
                evaluatedChildren = unionedEvaluatedChildren;
            }
            return evaluatedChildren;
        };
    };

    ForLoopStatement.prototype.evaluate = function(context, inst) {

        if (inst.context === undefined){
            inst.context = context;
        }

        return this.forEval([], inst, 0, inst.argnames, inst.argvalues, inst.context);
    };

    function Echo(a){
        ControlModule.call(this, a);
    };

    Echo.prototype.evaluate = function(parentContext, inst){
        var context = new Context(parentContext);
        var argvalues = [];
        
        _.each(inst.argexpr, function(expr,index,list) {
            argvalues.push(Globals.convertForStrFunction(expr.evaluate(context)));
        });

        logMessage(_.template("ECHO: <%=argvalues%>", {argvalues:argvalues}));

        return undefined;
    };


	return {
		Echo: Echo,
		ForLoopStatement: ForLoopStatement,
		IfStatement: IfStatement
	}

});