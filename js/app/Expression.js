define("Expression", ["Range"], function(Range){

	function Expression(value) {
        this.children = [];
        this.const_value = value;
        this.var_name;
        this.call_funcname;
        this.call_argnames = [];
        this.type = "C";
    };

    Expression.prototype.evaluate = function(context) {
            
        switch (this.type){

            case "!":
                return ! this.children[0].evaluate(context);
                break;
            case "&&":
                return this.children[0].evaluate(context) && this.children[1].evaluate(context);
                break;
            case "||":
                return this.children[0].evaluate(context) || this.children[1].evaluate(context);
                break;
            case "*":
                return this.children[0].evaluate(context) * this.children[1].evaluate(context);
                break;
            case "/":
                return this.children[0].evaluate(context) / this.children[1].evaluate(context);
                break;
            case "%":
                return this.children[0].evaluate(context) % this.children[1].evaluate(context);
                break;
            case "+":
                return this.children[0].evaluate(context) + this.children[1].evaluate(context);
                break;
            case "-":
                return this.children[0].evaluate(context) - this.children[1].evaluate(context);
                break;
            case "<":
                return this.children[0].evaluate(context) < this.children[1].evaluate(context);
                break;
            case "<=":
                return this.children[0].evaluate(context) <= this.children[1].evaluate(context);
                break;
            case "==":
                return this.children[0].evaluate(context) == this.children[1].evaluate(context);
                break;
            case "!=":
                return this.children[0].evaluate(context) != this.children[1].evaluate(context);
                break;
            case ">=":
                return this.children[0].evaluate(context) >= this.children[1].evaluate(context);
                break;
            case ">":
                return this.children[0].evaluate(context) > this.children[1].evaluate(context);
                break;
            case "?:":
                var v = this.children[0].evaluate(context);
                return this.children[v ? 1 : 2].evaluate(context);
                break;
            case "I":
                return -this.children[0].evaluate(context);
                break;
            case "C":
                return this.const_value;
                break;
            case "R":
                var v1 = this.children[0].evaluate(context);
                var v2 = this.children[1].evaluate(context);
                var v3 = this.children[2].evaluate(context);
                if (_.isNumber(v1) && _.isNumber(v2) && _.isNumber(v3)) {
                    return new Range(v1, v2, v3);
                }
                return undefined;
                break;
            case "V":
                var vec = [];
                for (var i = 0; i < this.children.length; i++) {
                    vec.push(this.children[i].evaluate(context));
                };
                return vec;
                break;
            case "L":
                return context.lookupVariable(this.var_name);
                break;
            case "[]":
                return this.children[0].evaluate(context)[this.children[1].evaluate(context)];
                break;
            case "F":
                var argvalues =[];
                for (var i = 0; i < this.children.length; i++){
                      argvalues.push(this.children[i].evaluate(context));
                }

                return context.evaluateFunction(this.call_funcname, this.call_argnames, argvalues);
                break;
            default: 
                console.log("todo - evaluate expression", this);
        }    
    };

    return Expression;
});