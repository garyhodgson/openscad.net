

/* description: Parses openscad to openjscad. */

/* lexical grammar */

%lex

%s cond_include cond_use cond_comment cond_string

D [0-9]
E [Ee][+-]?{D}+

%%

include[ \t\r\n>]*"<"        this.begin('cond_include');
<cond_include>[^\t\r\n>]*"/" yy.filepath = yytext;
<cond_include>[^\t\r\n>/]+   yy.filename = yytext;
<cond_include>">"            %{  this.begin('INITIAL'); %}

use[ \t\r\n>]*"<"           this.begin('cond_use');
<cond_use>[^\t\r\n>]+       yy.filename = yytext;
<cond_use>">"               %{  this.begin('INITIAL'); %}


"module"                    return 'TOK_MODULE'
"function"                  return 'TOK_FUNCTION'
"if"                        return 'TOK_IF'
"else"                      return 'TOK_ELSE'
"true"                      return 'TOK_TRUE'
"false"                     return 'TOK_FALSE'
"undef"                     return 'TOK_UNDEF'

[\n]                        /* Ignore */
[\r\t ]                     /* Ignore */
\/\/[^\n]*\n?               /* Ignore */
\/\*.*\*\/                  /* Ignore */
"/*"                        this.begin('cond_comment');
<cond_comment>"*/"          %{  this.begin('INITIAL'); %}
<cond_comment>.|\n             /* Ignore */

{D}*\.{D}+{E}?              return 'TOK_NUMBER'
{D}+\.{D}*{E}?              return 'TOK_NUMBER'
{D}+{E}?                    return 'TOK_NUMBER'
"$"?[a-zA-Z0-9_]+           return 'TOK_ID'

[\"\'][^\"\']*[\"\']        return 'TOK_STRING'  //"




"<="                        return 'LE'
">="                        return 'GE'
"=="                        return 'EQ'
"!="                        return 'NE'
"&&"                        return 'AND'
"||"                        return 'OR'

.                           return yytext;

/lex

/* operator associations and precedence */

%right '?' ':'
%left OR
%left AND
%left '<' LE GE '>'
%left EQ NE
%left '!' '+' '-'
%left '*' '/' '%'
%left '[' ']'
%left '.'

%start program

%% /* language grammar */

program:
        input
        { 

            var lines = [];
            lines.push("function main(){");
            lines.push("\n");

            var context = undefined;
            if (yy.context !== undefined){
                context = yy.context;
            }

            if (yy.logMessage !== undefined){
                logMessage = yy.logMessage;
            } else {
                logMessage = localLog;
            }

            var res = currmodule.evaluate(context);

            var evaluatedLines = _.flatten(res);
            if (evaluatedLines.length == 1){
                lines.push("return "+evaluatedLines[0] + ';');
            } else if (evaluatedLines.length > 1){
                lines.push("return "+_.first(evaluatedLines)+".union([");
                lines.push(_.rest(evaluatedLines));
                lines.push("]);");
            }
            lines.push("};");

            var x = {lines:lines, context:context_stack[context_stack.length-1]};
            resetModule();

            return x;
        }
    ;


input: 
        /* empty */ 
    |   input statement 
    ;

inner_input: 
        /* empty */ 
    |   inner_input statement 
    ;

statement: 
        statement_begin statement_end
    ;

statement_begin:
        /*empty*/
    |   TOK_MODULE TOK_ID '(' arguments_decl optional_commas ')'
        {

            var p_currmodule = currmodule;
            module_stack.push(currmodule);
            
            currmodule = new Module($2);

            p_currmodule.modules.push(currmodule);

            currmodule.argnames = $4.argnames;
            currmodule.argexpr = $4.argexpr;
            
            delete $4;
           
        } 

    ;

statement_end: 
        ';'
        {           
        }
    |   '{' inner_input '}'
        {
            if (module_stack.length > 0){
                currmodule = module_stack.pop();
            }
        } 
    |   module_instantiation 
        {
            currmodule.children.push($1);
        } 
    |   TOK_ID '=' expr ';'
        {  
            currmodule.assignments_var[$1] = $3; 
        }
    |   TOK_FUNCTION TOK_ID '(' arguments_decl optional_commas ')' '=' expr ';'
        {
            var func = new FunctionDef();
            func.argnames = $4.argnames;
            func.argexpr = $4.argexpr;
            func.expr = $8;
            currmodule.functions[$2] = func;
            delete $4;
        }
    |   BR
    ;

children_instantiation:
        module_instantiation 
        {   
            $$ = new ModuleInstantiation();
            if ($1) { 
                $$.children.push($1);
            }
        }
    |   '{' module_instantiation_list '}' 
        {
            $$ = $2; 
        }
    ;


if_statement:
        TOK_IF '(' expr ')' children_instantiation 
        {
            $$ = new IfElseModuleInstantiation();
            $$.argnames.push("");
            $$.argexpr.push($3);

            if ($$) {
                $$.children = $5.children;
            } else {
                for (var i = 0; i < $5.children.size(); i++)
                    delete $5.children[i];
            }
            delete $5;
        } 
    ;

ifelse_statement:
        if_statement 
        {
            $$ = $1;
        } 
    |   if_statement TOK_ELSE children_instantiation 
        {
            $$ = $1;
            if ($$) {
                $$.else_children = $3.children;
            } else {
                for (var i = 0; i < $3.children.size(); i++)
                    delete $3.children[i];
            }
            delete $3;
        } 
    ;

module_instantiation:
        single_module_instantiation ';' 
        { 
            $$ = $1; 
        } 
    |   single_module_instantiation children_instantiation 
        {   
            $$ = $1;
            if ($$) {
                $$.children = $2.children;
            } else {
                for (var i = 0; i < $2.children.length; i++)
                delete $2.children[i];
            }   
            delete $2;
        } 
    |   
        ifelse_statement 
        {
            $$ = $1;
        }
    ;

module_instantiation_list:
        /* empty */ 
        { 
            $$ = new ModuleInstantiation(); 
        }
    |   module_instantiation_list module_instantiation 
        {
            $$ = $1;
            if ($$) {
                if ($2) {
                    $$.children.push($2);
                }
            } else {
                delete $2;
            }
        }
    ;

single_module_instantiation:
        TOK_ID '(' arguments_call ')' 
        {   
            $$ = new ModuleInstantiation();
            $$.name = $1;
            $$.argnames = $3.argnames;
            $$.argexpr = $3.argexpr;
            delete $3;
        } 
    |   '!' single_module_instantiation 
        {
            $$ = $2;
            if ($$) {
                $$.tag_root = true;
            }                
        }
    |   '#' single_module_instantiation 
        {
            $$ = $2;
            if ($$) {
                $$.tag_highlight = true;
            }
        } 
    |   '%' single_module_instantiation 
        {
            /* - NOTE: Currently unimplemented, therefore not displaying parts marked with %
                $$ = $2;
                if ($$) {
                    $$.tag_background = true;
                }
            */
            delete $2;
            $$ = undefined;
        }
    |   '*' single_module_instantiation 
        {
            delete $2;
            $$ = undefined;
        }
    ;

expr:
        TOK_TRUE 
        {   
            $$ = new Expression(true); 
        }
    |   TOK_FALSE 
        { 
            $$ = new Expression(false); 
        }
    |   TOK_UNDEF 
        {
            $$ = new Expression(undefined);
        }
    |   TOK_ID 
        {
            $$ = new Expression();
            $$.type = "L";
            $$.var_name = $1;
        }
    |   expr '.' TOK_ID 
        {   
            $$ = new Expression();
            $$.type = "N";
            $$.children.push($1);
            $$.var_name = $3;
        }  
    |   TOK_STRING 
        { 
            $$ = new Expression(String($1)); 
        } 
    |   TOK_NUMBER 
        {
            $$ = new Expression(Number($1));
        } 
    |   '[' expr ':' expr ']' 
        {
            var e_one = new Expression(1.0);
            $$ = new Expression();
            $$.type = "R";
            $$.children.push($2);
            $$.children.push(e_one);
            $$.children.push($4);
        } 
    |   '[' expr ':' expr ':' expr ']' 
        {
            $$ = new Expression();
            $$.type = "R";
            $$.children.push($2);
            $$.children.push($4);
            $$.children.push($6);
        } 
    |   '[' optional_commas ']' 
        {
            $$ = new Expression([]); 
        } 
    |   '[' vector_expr optional_commas ']' 
        {
            $$ = $2; 
        } 
    |   expr '*' expr 
        { 
            $$ = new Expression();
            $$.type = '*';
            $$.children.push($1);
            $$.children.push($3); 
        }
    |   expr '/' expr 
        { 
            $$ = new Expression();
            $$.type = '/';
            $$.children.push($1);
            $$.children.push($3); 
        }
    |   expr '%' expr 
        { 
            $$ = new Expression();
            $$.type = '%';
            $$.children.push($1);
            $$.children.push($3); 
        }
    |   expr '+' expr 
        { 
            $$ = new Expression();
            $$.type = '+';
            $$.children.push($1);
            $$.children.push($3); 
        }
    |   expr '-' expr 
        { 
            $$ = new Expression();
            $$.type = '-';
            $$.children.push($1);
            $$.children.push($3); 
        }
    |   expr '<' expr 
        { 
            $$ = new Expression();
            $$.type = '<';
            $$.children.push($1);
            $$.children.push($3); 
        }
    |   expr LE expr 
        { 
            $$ = new Expression();
            $$.type = '<=';
            $$.children.push($1);
            $$.children.push($3); 
        }
    |   expr EQ expr 
        { 
            $$ = new Expression();
            $$.type = '==';
            $$.children.push($1);
            $$.children.push($3); 
        }
    |   expr NE expr 
        { 
            $$ = new Expression();
            $$.type = '!=';
            $$.children.push($1);
            $$.children.push($3); 
        }
    |   expr GE expr 
        { 
            $$ = new Expression();
            $$.type = '>=';
            $$.children.push($1);
            $$.children.push($3); 
        }
    |   expr '>' expr 
        { 
            $$ = new Expression();
            $$.type = '>';
            $$.children.push($1);
            $$.children.push($3); 
        }
    |   expr AND expr 
        { 
            $$ = new Expression();
            $$.type = '&&';
            $$.children.push($1);
            $$.children.push($3); 
        }
    |   expr OR expr 
        { 
            $$ = new Expression();
            $$.type = '||';
            $$.children.push($1);
            $$.children.push($3); 
        }
    |   '+' expr 
        { 
            $$ = $2; 
        }
    |   '-' expr 
        { 
            $$ = new Expression();
            $$.type = 'I';
            $$.children.push($2);
        }
    |   '!' expr 
        { 
            $$ = new Expression();
            $$.type = '!';
            $$.children.push($2);
        }
    |   '(' expr ')' 
            { $$ = $2; }
    |   expr '?' expr ':' expr 
        { 
            $$ = new Expression();
            $$.type = '?:';
            $$.children.push($1);
            $$.children.push($3);
            $$.children.push($5);
        }
    |   expr '[' expr ']' 
        { 
            $$ = new Expression();
            $$.type = '[]';
            $$.children.push($1);
            $$.children.push($3);
        }
    |   TOK_ID '(' arguments_call ')' 
        { 
            $$ = new Expression();
            $$.type = 'F';
            $$.call_funcname = $1;
            $$.call_argnames = $3.argnames;
            $$.children = $3.argexpr;
            delete $3;
        }
    ; 

optional_commas:
        ',' optional_commas 
    | 
    ;

vector_expr:
        expr 
        { 
            $$ = new Expression();
            $$.type = 'V';
            $$.children.push($1);
        }
    |   vector_expr ',' optional_commas expr 
        {   
            $$ = $1;
            $$.children.push($4);
        }
    ;

arguments_decl:
        /* empty */ 
        {
            $$ = new ArgsContainer();
        } 
    |   argument_decl 
        {
            $$ = new ArgsContainer();
            $$.argnames.push($1.argname);
            $$.argexpr.push($1.argexpr);
            delete $1;
        }
    |   arguments_decl ',' optional_commas argument_decl 
        {
            $$ = $1;
            $$.argnames.push($4.argname);
            $$.argexpr.push($4.argexpr);
            delete $4;
        } 
    ;

argument_decl:
        TOK_ID 
        {
            $$ = new ArgContainer();
            $$.argname = $1;
            $$.argexpr = undefined;
        } 
    |   TOK_ID '=' expr 
        {
            $$ = new ArgContainer();
            $$.argname = $1;
            $$.argexpr = $3;
        } 
    ;

arguments_call:
        /* empty */
        {
            $$ = new ArgsContainer();
        } 
    |   argument_call 
        { 
            $$ = new ArgsContainer();
            $$.argnames.push($1.argname);
            $$.argexpr.push($1.argexpr);
            delete $1;
        }
    |   arguments_call ',' optional_commas argument_call 
        { 
            $$ = $1;
            $$.argnames.push($4.argname);
            $$.argexpr.push($4.argexpr);
            delete $4;
        }
    ;

argument_call:
        expr 
        { 
            $$ = new ArgContainer();
            $$.argexpr = $1;
        }
    |   TOK_ID '=' expr 
        { 
            $$ = new ArgContainer();
            $$.argname = $1;
            $$.argexpr = $3;
        }
    ;

%%

// Note: Uncomment the following lines to use the parser with node, e.g. for testing.
//var _ = require("underscore");
//require("./csg.js");
//require("./openscad-parser-support.js");

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

function Range(begin,step,end) {
    this.begin = begin;
    this.step = step;
    this.end = end;
};

function ArgContainer() {
    this.argname;
    this.argexpr;
};

function ArgsContainer() {
    this.argnames = [];
    this.argexpr = [];
};

function Module(name) {
    this.name = name;
    this.children = [];
    this.assignments_var = {};
    this.functions = {};
    this.modules = [];
    this.argnames = [];
    this.argexpr = [];
    this.currentSubmodule = 0;
};

Module.prototype.evaluate = function(parentContext, inst) {
    var lines = [];

    var context = new Context(parentContext);

    if (parentContext === undefined){
        context.setVariable("$fn", DEFAULT_RESOLUTION);
        context.setVariable("$fs", 2.0);
        context.setVariable("$fa", 12.0);
    }

    if (inst !== undefined) {
        context.args(this.argnames, this.argexpr, inst.argnames, inst.argvalues);
        context.setVariable("$children", inst.children.length);
    }

    context.inst_p = inst;
    context.functions_p = this.functions;
    context.modules_p = this.modules;

    _.each(this.assignments_var, function(value, key, list) {
        context.setVariable(key, value.evaluate(context));
    });

    var controlChildren = _.filter(this.children, function(child){ 
        return child && child.name == "echo"; 
    });

    _.each(controlChildren, function(child, index, list) {
        child.evaluate(context);
    });

    var nonControlChildren = _.reject(this.children, function(child){ 
        return !child || child.name == "echo"; 
    });

    var evaluatedLines = [];
    _.each(nonControlChildren, function(child, index, list) {

        var evaluatedChild = child.evaluate(context)
        if (evaluatedChild == undefined || (_.isArray(evaluatedChild) && _.isEmpty(evaluatedChild))){
            // ignore
        } else {
            evaluatedLines.push(evaluatedChild);
        }
    });

    var cleanedLines = _.compact(evaluatedLines);
    if (cleanedLines.length == 1){
        lines.push(cleanedLines[0]);
    } else if (cleanedLines.length > 1){
        lines.push(_.first(cleanedLines)+".union([" +_.rest(cleanedLines)+"])");
    }
    
    return lines;
};

function ModuleInstantiation() {
    this.name;
    this.argnames = [];
    this.argvalues = [];
    this.argexpr = [];
    this.children = [];
    this.isSubmodule = false;
    this.context;
};

ModuleInstantiation.prototype.evaluate = function(context) {

    var evaluatedModule;

    // NOTE: not sure how we should handle this in javascript ... is it necessary?
    //if (this.context === null) {
    //    console.log("WARNING: Ignoring recursive module instantiation of ", this.name);
    //} else {
        var that = this;

        this.argvalues = [];

        _.each(this.argexpr, function(expr,index,list) {
            that.argvalues.push(expr.evaluate(context));
        });

        that.context = context;

        evaluatedModule = context.evaluateModule(that);

        that.context = null;
        that.argvalues = [];

    //}
    return evaluatedModule;
};

ModuleInstantiation.prototype.evaluateChildren = function(context) {

    var childModules = []

    for (var i = 0; i < this.children.length; i++) {
        var childInst = this.children[i];
        
        var evaluatedChild = childInst.evaluate(context);
        if (evaluatedChild !== undefined){
            childModules.push(evaluatedChild);
        }
    };
    
    return childModules;
};

function IfElseModuleInstantiation() {
    ModuleInstantiation.call(this);
    this.name = "if";
    this.else_children = [];
};

IfElseModuleInstantiation.prototype = new ModuleInstantiation();

IfElseModuleInstantiation.prototype.constructor = IfElseModuleInstantiation;

function Context(parentContext) {
    this.vars = {};
    this.parentContext = parentContext;
    this.inst_p;
    this.functions_p = {};
    this.modules_p = {};
    context_stack.push(this);
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

Context.prototype.evaluateModule = function(inst) {

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
        return this.parentContext.evaluateModule(inst);
    }

    console.log("WARNING: Ignoring unknown module: " + inst.name);
    return undefined;
};

function FunctionDef() {
    this.argnames = [];
    this.argexpr = [];
    this.expr;
};

FunctionDef.prototype.evaluate = function(parentContext, call_argnames, call_argvalues) {

    var context = new Context(parentContext);
    context.args(this.argnames, this.argexpr, call_argnames, call_argvalues);

    if (this.expr !== undefined)
        return this.expr.evaluate(context);

    return undefined;
};


function CoreModule(){};

function newContext (parentContext, argnames, argexpr, inst) {
    var context = new Context(parentContext);
    context.args(argnames, argexpr, inst.argnames, inst.argvalues);
    return context;
};


CoreModule.prototype.evaluate = function(parentContext, inst) {
    throw Error("Should be overridden");
};

function PrimitiveModule(a){
  CoreModule.call(this, a);
};

function ControlModule(a){
  CoreModule.call(this, a);  
};

function OpenjscadSolidFactory(){};

OpenjscadSolidFactory.prototype.getAdaptor = function(args) {
    switch(args.name){
        case "cube": 
            return new Cube();
        case "sphere":
            return new Sphere();
        case "cylinder":
            return new Cylinder();
        case "polyhedron":
            return new Polyhedron();
        case "circle":
            return new Circle();
        case "square":
            return new Square();
        case "polygon":
            return new Polygon();
        case "union":
            return new CSGModule("union");
        case "difference":
            return new CSGModule("subtract");
        case "intersect":
        case "intersection":
            return new CSGModule("intersect");
        case "translate":
            return new TranslateTransform();
        case "scale":
            return new ScaleTransform();
        case "rotate":
            return new RotateTransform();
        case "mirror":
            return new MirrorTransform();
        case "linear_extrude":
            return new ExtrudeTransform();
        case "color":
            return new ColorTransform();
        case "echo":
            return new Echo();
        case "multmatrix":
            return new MultimatrixTransform();
        case "for":
            return new ForLoopStatement({csgOp:"union"});
        case "intersection_for":
            return new ForLoopStatement({csgOp:"intersect"});
        case "if":
            return new IfStatement();
        case "child":
            return new Child();
        case "render":
        case "assign": // Note: assign does the same as render in this case - re-evaluate the arguments and process the children.
            return new RenderModule();
        default:
            if (args instanceof ModuleInstantiation){
                return new ModuleAdaptor()
            }
            return undefined;
    }
};


function ModuleAdaptor(a){
    CoreModule.call(this, a);
};

ModuleAdaptor.prototype.evaluate = function(parentContext, inst){
    inst.isSubmodule = true;
    return parentContext.evaluateModule(inst);
};

function RenderModule(a){
    TransformModule.call(this, a);
};

RenderModule.prototype.evaluate = function(parentContext, inst){

    inst.argvalues = [];

    _.each(inst.argexpr, function(expr,index,list) {
        inst.argvalues.push(expr.evaluate(parentContext));
    });

    var context = newContext(parentContext, [], [], inst);


    var childIndex = 0;
    if (inst.argvalues[0] !== undefined){
        childIndex = inst.argvalues[0];
    }

    return this.transformChildren(inst.children, context, function(){
        return "";
    });
};


function printContext(c){
    console.log(c.vars);
    if (c.parentContext){
        printContext(c.parentContext);
    }
}

function Child(a){
    CoreModule.call(this, a);
};

Child.prototype.evaluate = function(parentContext, inst){
    
    inst.argvalues = [];
    _.each(inst.argexpr, function(expr,index,list) {
        inst.argvalues.push(expr.evaluate(parentContext));
    });

    var context = newContext(parentContext, [], [], inst);

    var childIndex = 0;
    if (inst.argvalues[0] !== undefined){
        childIndex = inst.argvalues[0];
    }

    var evaluatedChildren = [];

    for (var i = context_stack.length - 1; i >= 0; i--) {
        var ctx = context_stack[i];

        if (ctx.inst_p !== undefined){
            if (childIndex < ctx.inst_p.children.length) {

                var childInst = ctx.inst_p.children[childIndex];

                _.each(childInst.argexpr, function(expr,index,list) {
                    childInst.argvalues.push(expr.evaluate(ctx.inst_p.ctx));
                });

                var childAdaptor = factory.getAdaptor(childInst);
                evaluatedChildren.push(childAdaptor.evaluate(ctx.inst_p.ctx, childInst));

            }
            return evaluatedChildren;
        }
        ctx = ctx.parentContext;
    };
    
    return undefined;
};


function ExtrudeTransform(a){
    TransformModule.call(this, a);
};

ExtrudeTransform.prototype.evaluate = function(parentContext, inst){
    inst.argvalues = [];

    _.each(inst.argexpr, function(expr,index,list) {
        inst.argvalues.push(expr.evaluate(parentContext));
    });


    var context = newContext(parentContext, ["file", "layer", "height", "origin", "scale", "center", "twist", "slices", "$fn", "$fs", "$fa"], [], inst);

    var height = contextVariableLookup(context, "height", 100);
    var center = contextVariableLookup(context, "center", false);
    var twist = Number(contextVariableLookup(context, "twist", 0))/-1; // note inverse for openjscad
    var slices = contextVariableLookup(context, "slices", undefined);
    var fn = contextVariableLookup(context, "$fn", FN_DEFAULT);
    var fs = contextVariableLookup(context, "$fs", FS_DEFAULT);
    var fa = contextVariableLookup(context, "$fa", FA_DEFAULT);

    if (slices === undefined){
        slices = parseInt(Math.max(2, Math.abs(get_fragments_from_r(height, context) * twist / 360)));
    }

    return this.transformChildren(inst.children, context, function(){
        var template = _.template(".extrude({offset: [0, 0, <%=height%>], twistangle: <%=twist%>,twiststeps: <%=slices%>})", {height:height, twist:twist, slices:slices});
        if (center){
            var offset = -height/2;
            template += _.template(".translate([0,0,<%=offset%>])", {offset:offset});
        }
        return template;
    });
};

function IfStatement(a){
    ControlModule.call(this, a);
};

IfStatement.prototype.evaluate = function(parentContext, inst){
    inst.argvalues = [];

    _.each(inst.argexpr, function(expr,index,list) {
        inst.argvalues.push(expr.evaluate(parentContext));
    });

    var context = newContext(parentContext, [], [], inst);

    var childrenToEvaluate = (inst.argvalues.length > 0 && inst.argvalues[0])? inst.children : inst.else_children;

    var childModules = [];

    for (var i = 0; i < childrenToEvaluate.length; i++) {

        var childInst = childrenToEvaluate[i];

        childInst.argvalues = [];

        _.each(childInst.argexpr, function(expr,index,list) {
            childInst.argvalues.push(expr.evaluate(context));
        });

        var childAdaptor = factory.getAdaptor(childInst);

        childModules.push(childAdaptor.evaluate(context, childInst));
    };
    if (_.isEmpty(childModules)){
        return undefined;
    } else {
        return childModules;
    }
};

function ForLoopStatement(a){
    ControlModule.call(this, a);
    this.csgOp = a.csgOp;

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

function MultimatrixTransform(a){
    TransformModule.call(this, a);

    this.transposeMatrix = function(m) {
        var t = []
        var ti = 0;

        for (var j in _.range(4)){
            for (var i in _.range(4)){
                t[ti++] = m[i][j];
            }
        }
        return t;
    };
};

MultimatrixTransform.prototype.evaluate = function(parentContext, inst){

    inst.argvalues = [];

    _.each(inst.argexpr, function(expr,index,list) {
        inst.argvalues.push(expr.evaluate(parentContext));
    });

    var context = newContext(parentContext, ["m"], [], inst);

    var m = contextVariableLookup(context, "m", undefined);

    var matrix;
    if (m !== undefined){
        matrix = this.transposeMatrix(m);
    }

    return this.transformChildren(inst.children, context, function(){
        return _.template('.transform(new CSG.Matrix4x4( [<%= matrix %>] ))', {matrix:matrix});
    });
};


function Echo(a){
    ControlModule.call(this, a);
};

Echo.prototype.evaluate = function(parentContext, inst){
    var context = new Context(parentContext);
    var argvalues = [];
    
    _.each(inst.argexpr, function(expr,index,list) {
        argvalues.push(convertForStrFunction(expr.evaluate(context)));
    });

    logMessage(_.template("ECHO: <%=argvalues%>", {argvalues:argvalues}));

    return undefined;
};


function TransformModule(a){
  CoreModule.call(this, a);

  this.transformChildren = function (children, context, cb) {
      var childModules = []

        for (var i = 0; i < children.length; i++) {

            var childInst = children[i];

            childInst.argvalues = [];  // NOTE: not sure if this is the right solution!

            _.each(childInst.argexpr, function(expr,index,list) {
                childInst.argvalues.push(expr.evaluate(context));
            });
            var childAdaptor = factory.getAdaptor(childInst);
            var transformedChild = childAdaptor.evaluate(context, childInst);
            transformedChild += cb();
            
            childModules.push(transformedChild);
        };

        if (childModules.length == 1){
            return childModules[0];
        } else {
            return _.first(childModules)+".union([" + _.rest(childModules) + "])";
        }
        
  }

};


function ColorTransform(a){
  TransformModule.call(this, a);
};

ColorTransform.prototype.evaluate = function(parentContext, inst){

    inst.argvalues = [];

    _.each(inst.argexpr, function(expr,index,list) {
        inst.argvalues.push(expr.evaluate(parentContext));
    });

    var context = newContext(parentContext, ["c", "alpha"], [], inst);

    var c = contextVariableLookup(context, "c", undefined);
    var color = "white";
    if (c !== undefined){
        color = _.isString(c)? colorNameLookup[stripString(c.toLowerCase())] : c;
    }

    var alpha = contextVariableLookup(context, "alpha", undefined);
    if (alpha !== undefined){
        color[3] = alpha;
    }

    return this.transformChildren(inst.children, context, function(){
        return _.template('.setColor(<%=color%>)', {color:color});
    });
};



function MirrorTransform(a){
    TransformModule.call(this, a);
};

MirrorTransform.prototype.evaluate = function(parentContext, inst){

    inst.argvalues = [];

    _.each(inst.argexpr, function(expr,index,list) {
        inst.argvalues.push(expr.evaluate(parentContext));
    });

    var context = newContext(parentContext, ["v"], [], inst);
    
    var v = contextVariableLookup(context, "v", [0,0,0]);
    
    if (!(v instanceof Array)){
        var val = v;
        v = [val,val,val];
    }

    return this.transformChildren(inst.children, context, function(){
        return _.template('.mirrored(CSG.Plane.fromNormalAndPoint([<%=v%>], [0,0,0]))', {v:v});
    });
};


function RotateTransform(a){
    TransformModule.call(this, a);
};

RotateTransform.prototype.evaluate = function(parentContext, inst){
    
    inst.argvalues = [];

    _.each(inst.argexpr, function(expr,index,list) {
        inst.argvalues.push(expr.evaluate(parentContext));
    });

    var context = newContext(parentContext, ["a","v"], [], inst);

    var a = contextVariableLookup(context, "a", undefined);

    if (_.isArray(a)){
        return this.transformChildren(inst.children, context, function(){
            return _.template('.rotateX(<%=degreeX%>).rotateY(<%=degreeY%>).rotateZ(<%=degreeZ%>)', {degreeX:a[0],degreeY:a[1],degreeZ:a[2]});
        });
    } else {
        var v = contextVariableLookup(context, "v", undefined);
        return this.transformChildren(inst.children, context, function(){
            if (v.toString() =="0,0,0"){
                v = [0,0,1];
            }
            return _.template('.transform(CSG.Matrix4x4.rotation([0,0,0], [<%=vector%>], <%=degree%>))', {degree:a, vector:v});
        });
    }
};


function ScaleTransform(a){
    TransformModule.call(this, a);
};

ScaleTransform.prototype.evaluate = function(parentContext, inst){
    
    inst.argvalues = [];

    _.each(inst.argexpr, function(expr,index,list) {
        inst.argvalues.push(expr.evaluate(parentContext));
    });

    var context = newContext(parentContext, ["v"], [], inst);

    var v = contextVariableLookup(context, "v", [0,0,0]);

    return this.transformChildren(inst.children, context, function(){
        return _.template('.scale([<%=v%>])', {v:v});
    });
};


function TranslateTransform(a){
    TransformModule.call(this, a);
};

TranslateTransform.prototype.evaluate = function(parentContext, inst){

    inst.argvalues = [];

    _.each(inst.argexpr, function(expr,index,list) {
        inst.argvalues.push(expr.evaluate(parentContext));
    });

    var context = newContext(parentContext, ["v"], [], inst);

    var v = contextVariableLookup(context, "v", [0,0,0]);

    return this.transformChildren(inst.children, context, function(){
        return _.template('.translate([<%=v%>])', {v:v});
    });

};

function CSGModule(csgOperation){
    this.csgOperation = csgOperation;
};

CSGModule.prototype.evaluate = function(parentContext, inst){
    var context = new Context(parentContext);

    var childModules = []

    for (var i = 0; i < inst.children.length; i++) {

        var childInst = inst.children[i];
        childInst.argvalues = [];
        _.each(childInst.argexpr, function(expr,index,list) {
            childInst.argvalues.push(expr.evaluate(context));
        });
        
        var childAdaptor = factory.getAdaptor(childInst);

        var evaluatedChild = childAdaptor.evaluate(parentContext, childInst);
        if (evaluatedChild !== undefined){
            childModules.push(evaluatedChild);
        }
    };
    if (childModules.length <= 1){
        return childModules[0];
    } else {
        return childModules[0] + "."+this.csgOperation+"([" + childModules.slice(1).join(',\n') + "])";
    }
};

function Sphere(a){
  PrimitiveModule.call(this, a);
};

Sphere.prototype.evaluate = function(parentContext, inst){
    var context = new Context(parentContext);

    var argnames = ["r", "$fn"];
    var argexpr = [];

    context.args(argnames, argexpr, inst.argnames, inst.argvalues);
    
    var r = contextVariableLookup(context, "r", 1);
    var resolution = get_fragments_from_r(r, context);

    var openjscadParameters = {center:[0,0,0], resolution:resolution, radius:r};
               
    return _.template('CSG.sphere({center: [<%=String(center)%>], radius: <%= radius %>, resolution: <%= resolution%>})', openjscadParameters);
}

function Cylinder(a){
  PrimitiveModule.call(this, a);
};

Cylinder.prototype.evaluate = function(parentContext, inst) {

    var context = new Context(parentContext);

    var argnames = ["h", "r1", "r2", "center", "$fn", "$fa", "$fs"];
    var argexpr = [];

    context.args(argnames, argexpr, inst.argnames, inst.argvalues);

    var openjscadArgs = {start: [0,0,0], end: [0,0,1], radiusStart: 1, radiusEnd: 1, resolution: DEFAULT_RESOLUTION};
    var isCentered = contextVariableLookup(context, "center", false);
    var h = contextVariableLookup(context, "h", 1);
    var r = contextVariableLookup(context, "r", 1);
    var r1 = contextVariableLookup(context, "r1", undefined);
    var r2 = contextVariableLookup(context, "r2", undefined);
                
    var startZ = isCentered? -(h/2) : 0;
    var endZ = isCentered? h/2 : h;

    openjscadArgs.start = [0, 0, startZ];
    openjscadArgs.end = [0, 0, endZ];

    /* we have to check the context vars directly here in case a parent module in the context stack has the same parameters, e.g. r1 which would be used as default.
       Example testcad case:
            module ring(r1, r2, h) {
                cylinder(r = 3, h = h);
            }
            ring(8, 6, 10);
    */
    if (_.has(context.vars, 'r')) {
        openjscadArgs.radiusStart = r;
        openjscadArgs.radiusEnd = r;
    }
    if (_.has(context.vars, 'r1')) {
        openjscadArgs.radiusStart = r1;
    }
    if (_.has(context.vars, 'r2')) {
        openjscadArgs.radiusEnd = r2;
    }
    openjscadArgs.resolution = get_fragments_from_r(Math.max(openjscadArgs.radiusStart, openjscadArgs.radiusEnd), context);
    
    return _.template('CSG.cylinder({start: [<%=start%>], end: [<%=end%>],radiusStart: <%=radiusStart%>, radiusEnd: <%=radiusEnd%>, resolution: <%=resolution%>})', openjscadArgs);    
};


function Cube(a){
  PrimitiveModule.call(this, a);
};

Cube.prototype.evaluate = function(parentContext, inst) {
    var context = new Context(parentContext);

    var argnames = ["size", "center"];
    var argexpr = [];

    context.args(argnames, argexpr, inst.argnames, inst.argvalues);

    var openjscadArgs = {resolution:DEFAULT_RESOLUTION};
    var isCentered = contextVariableLookup(context, "center", false);
    var size = contextVariableLookup(context, "size", 1);
    
    if (size instanceof Array){
        openjscadArgs.radius = [size[0]/2, size[1]/2, size[2]/2];
    } else {
        openjscadArgs.radius = [size/2,size/2,size/2];
    }

    if (isCentered){
        openjscadArgs.centerVector = [0,0,0];
    } else {
        openjscadArgs.centerVector = [openjscadArgs.radius[0],openjscadArgs.radius[1],openjscadArgs.radius[2]];
    }

    return _.template('CSG.cube({center: [<%=String(centerVector)%>],radius: [<%= radius %>], resolution: <%= resolution%>})', openjscadArgs);
};

function Polyhedron(a){
    TransformModule.call(this, a);
};

Polyhedron.prototype.evaluate = function(parentContext, inst){
    var context = newContext(parentContext, ["points", "triangles", "convexity"], [], inst);

    var points = contextVariableLookup(context, "points", []);
    var triangles = contextVariableLookup(context, "triangles", []);
    
    var polygons=[];

    _.each(triangles, function(triangle) {
        polygons.push(
            _.template("new CSG.Polygon([new CSG.Vertex(new CSG.Vector3D([<%=vec1%>])),new CSG.Vertex(new CSG.Vector3D([<%=vec2%>])),new CSG.Vertex(new CSG.Vector3D([<%=vec3%>]))])", 
                {vec1:points[triangle[2]],
                vec2:points[triangle[1]],
                vec3:points[triangle[0]]}));
    });

    return _.template("CSG.fromPolygons([<%=polygons%>])", {polygons:polygons});   
};


function Circle(a){
    PrimitiveModule.call(this, a);
};

Circle.prototype.evaluate = function(parentContext, inst){
    var context = newContext(parentContext, ["r", "$fn"], [], inst);

    var r = contextVariableLookup(context, "r", 1);
    var resolution = get_fragments_from_r(r, context);
    
    return _.template('CAG.circle({center: [0,0], radius: <%=r%>, resolution: <%=resolution%>})', {r:r,resolution:resolution});
    
};


function Square(a){
    PrimitiveModule.call(this, a);
};

Square.prototype.evaluate = function(parentContext, inst){
    var context = newContext(parentContext, ["size", "center"], [], inst);

    var size = contextVariableLookup(context, "size", [0.5,0.5]);
    var center = contextVariableLookup(context, "center", false);
    var radius = _.isArray(size)? radius = [size[0]/2,size[1]/2] : [size/2,size/2];
    var centerPoint = [0,0];
    if (!center){
        centerPoint = [size[0]/2, size[1]/2]
    }

    return _.template('CAG.rectangle({center: [<%=centerPoint%>], radius: [<%=radius%>]})', {centerPoint:centerPoint, radius:radius});
};

function Polygon(a){
    PrimitiveModule.call(this, a);
};

Polygon.prototype.evaluate = function(parentContext, inst){
    var context = newContext(parentContext, ["points", "paths", "convexity"], [], inst);

    var points = contextVariableLookup(context, "points", []);
    var paths = contextVariableLookup(context, "paths", []);
    var pointsMap = [];

    function formatPoints (points){
        return _.map(points, function(x){return _.template("[<%=x%>]", {x:x})});
    }

    if (_.isEmpty(paths)){
        return _.template('CAG.fromPoints([<%=points%>])', {points:formatPoints(points)});
    }

    if (paths.length > 1){
        var lines = "";

        _.each(_.first(paths), function(x) {
            pointsMap.push(points[x]);
        });
        lines += _.template('(new CSG.Path2D([<%=points%>],true)).innerToCAG().subtract([', {points:formatPoints(pointsMap)});
        
        var holes = [];
        
        _.each(_.rest(paths), function(shape) {
            pointsMap = [];
            _.each(shape, function(x) {
                pointsMap.push(points[x]);
            });
            holes.push(_.template('(new CSG.Path2D([<%=points%>],true)).innerToCAG()', {points:formatPoints(pointsMap)}));   
        });

        lines += holes.join(',') + "])";

        return lines;

    } else {
        _.each(paths[0], function(x) {
            pointsMap.push(points[x]);
        });
        return _.template('(new CSG.Path2D([<%=points%>],true)).innerToCAG()', {points:formatPoints(pointsMap)});
    }   
};

function contextVariableLookup(context, name, defaultValue){
    var val = context.lookupVariable(name);
    if (val === undefined){
        val = defaultValue;
    }
    return val;
}

var factory = new OpenjscadSolidFactory();
var currmodule = new Module("root");
var module_stack = [];
var context_stack = [];
var includes_stack = [];
var DEFAULT_RESOLUTION = 16;
var DEFAULT_2D_RESOLUTION = 16;
var FN_DEFAULT = 0;
var FS_DEFAULT = 2.0;
var FA_DEFAULT = 12.0;

var logMessage;

function stripString (s) {
    if (/^\".*\"$/.test(s)){
        return s.match(/^\"(.*)\"$/)[1];
    } else {
        return s;
    }
}

function convertForStrFunction(val){
    if (_.isString(val)){
        return stripString(val);
    }

    if (_.isArray(val)){
        var mapped = _.map(val, function (value, key, list) {
            return convertForStrFunction(value);
        });

        return "["+mapped.join(',')+"]";
    }

    return val;
}

var functionNameLookup = {"cos":Math.cosdeg,"sin":Math.sindeg, "acos":Math.acosdeg,"asin":Math.asindeg,"atan":Math.atandeg,"atan2":Math.atan2deg,"tan":Math.tandeg,"max":Math.max,"min":Math.min, "ln":Math.log, 
    "len":function(val){
        var x = _.isString(val[0]) ? stripString(val[0]) : val[0];
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
            vals.push(convertForStrFunction(x));
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

var colorNameLookup = {"indianred":[0.804,0.361,0.361], "lightcoral":[0.941,0.502,0.502], "salmon":[0.980,0.502,0.447], "darksalmon":[0.914,0.588,0.478], "lightsalmon":[1,0.627,0.478], "red":[1,0,0], "crimson":[0.863,0.078,0.235], "firebrick":[0.698,0.133,0.133], "darkred":[0.545,0,0], "pink":[1,0.753,0.796], "lightpink":[1,0.714,0.757], "hotpink":[1,0.412,0.706], "deeppink":[1,0.078,0.576], "mediumvioletred":[0.780,0.082,0.522], "palevioletred":[0.859,0.439,0.576], "lightsalmon":[1,0.627,0.478], "coral":[1,0.498,0.314], "tomato":[1,0.388,0.278], "orangered":[1,0.271,0], "darkorange":[1,0.549,0], "orange":[1,0.647,0], "gold":[1,0.843,0], "yellow":[1,1,0], "lightyellow":[1,1,0.878], "lemonchiffon":[1,0.980,0.804], "lightgoldenrodyellow":[0.980,0.980,0.824], "papayawhip":[1,0.937,0.835], "moccasin":[1,0.894,0.710], "peachpuff":[1,0.855,0.725], "palegoldenrod":[0.933,0.910,0.667], "khaki":[0.941,0.902,0.549], "darkkhaki":[0.741,0.718,0.420], "lavender":[0.902,0.902,0.980], "thistle":[0.847,0.749,0.847], "plum":[0.867,0.627,0.867], "violet":[0.933,0.510,0.933], "orchid":[0.855,0.439,0.839], "fuchsia":[1,0,1], "magenta":[1,0,1], "mediumorchid":[0.729,0.333,0.827], "mediumpurple":[0.576,0.439,0.859], "blueviolet":[0.541,0.169,0.886], "darkviolet":[0.580,0,0.827], "darkorchid":[0.600,0.196,0.800], "darkmagenta":[0.545,0,0.545], "purple":[0.502,0,0.502], "indigo":[0.294,0,0.510], "darkslateblue":[0.282,0.239,0.545], "slateblue":[0.416,0.353,0.804], "mediumslateblue":[0.482,0.408,0.933], "greenyellow":[0.678,1,0.184], "chartreuse":[0.498,1,0], "lawngreen":[0.486,0.988,0], "lime":[0,1,0], "limegreen":[0.196,0.804,0.196], "palegreen":[0.596,0.984,0.596], "lightgreen":[0.565,0.933,0.565], "mediumspringgreen":[0,0.980,0.604], "springgreen":[0,1,0.498], "mediumseagreen":[0.235,0.702,0.443], "seagreen":[0.180,0.545,0.341], "forestgreen":[0.133,0.545,0.133], "green":[0,0.502,0], "darkgreen":[0,0.392,0], "yellowgreen":[0.604,0.804,0.196], "olivedrab":[0.420,0.557,0.137], "olive":[0.502,0.502,0], "darkolivegreen":[0.333,0.420,0.184], "mediumaquamarine":[0.400,0.804,0.667], "darkseagreen":[0.561,0.737,0.561], "lightseagreen":[0.125,0.698,0.667], "darkcyan":[0,0.545,0.545], "teal":[0,0.502,0.502], "aqua":[0,1,1], "cyan":[0,1,1], "lightcyan":[0.878,1,1], "paleturquoise":[0.686,0.933,0.933], "aquamarine":[0.498,1,0.831], "turquoise":[0.251,0.878,0.816], "mediumturquoise":[0.282,0.820,0.800], "darkturquoise":[0,0.808,0.820], "cadetblue":[0.373,0.620,0.627], "steelblue":[0.275,0.510,0.706], "lightsteelblue":[0.690,0.769,0.871], "powderblue":[0.690,0.878,0.902], "lightblue":[0.678,0.847,0.902], "skyblue":[0.529,0.808,0.922], "lightskyblue":[0.529,0.808,0.980], "deepskyblue":[0,0.749,1], "dodgerblue":[0.118,0.565,1], "cornflowerblue":[0.392,0.584,0.929], "royalblue":[0.255,0.412,0.882], "blue":[0,0,1], "mediumblue":[0,0,0.804], "darkblue":[0,0,0.545], "navy":[0,0,0.502], "midnightblue":[0.098,0.098,0.439], "cornsilk":[1,0.973,0.863], "blanchedalmond":[1,0.922,0.804], "bisque":[1,0.894,0.769], "navajowhite":[1,0.871,0.678], "wheat":[0.961,0.871,0.702], "burlywood":[0.871,0.722,0.529], "tan":[0.824,0.706,0.549], "rosybrown":[0.737,0.561,0.561], "sandybrown":[0.957,0.643,0.376], "goldenrod":[0.855,0.647,0.125], "darkgoldenrod":[0.722,0.525,0.043], "peru":[0.804,0.522,0.247], "chocolate":[0.824,0.412,0.118], "saddlebrown":[0.545,0.271,0.075], "sienna":[0.627,0.322,0.176], "brown":[0.647,0.165,0.165], "maroon":[0.502,0,0], "white":[1,1,1], "snow":[1,0.980,0.980], "honeydew":[0.941,1,0.941], "mintcream":[0.961,1,0.980], "azure":[0.941,1,1], "aliceblue":[0.941,0.973,1], "ghostwhite":[0.973,0.973,1], "whitesmoke":[0.961,0.961,0.961], "seashell":[1,0.961,0.933], "beige":[0.961,0.961,0.863], "oldlace":[0.992,0.961,0.902], "floralwhite":[1,0.980,0.941], "ivory":[1,1,0.941], "antiquewhite":[0.980,0.922,0.843], "linen":[0.980,0.941,0.902], "lavenderblush":[1,0.941,0.961], "mistyrose":[1,0.894,0.882], "gainsboro":[0.863,0.863,0.863], "lightgrey":[0.827,0.827,0.827], "silver":[0.753,0.753,0.753], "darkgray":[0.663,0.663,0.663], "gray":[0.502,0.502,0.502], "dimgray":[0.412,0.412,0.412], "lightslategray":[0.467,0.533,0.600], "slategray":[0.439,0.502,0.565], "darkslategray":[0.184,0.310,0.310], "black":[0,0,0]};

function add_var(yy, id,val){

    if (yy.var_list == undefined){
        yy.var_list = {};    
    }

    yy.var_list[id] = val;
}

function localLog(msg){
    console.log(msg);
}

/*
    Returns the number of subdivision of a whole circle, given radius and
    the three special variables $fn, $fs and $fa
*/
function get_fragments_from_r(r, context) {
    var fn = contextVariableLookup(context, "$fn", FN_DEFAULT);
    var fs = contextVariableLookup(context, "$fs", FS_DEFAULT);
    var fa = contextVariableLookup(context, "$fa", FA_DEFAULT);

    var GRID_FINE   = 0.000001;
    if (r < GRID_FINE) return 0;
    if (fn > 0.0)
        return parseInt(fn);
    return parseInt(Math.ceil(Math.max(Math.min(360.0 / fa, r*2*Math.PI / fs), 5)));
}

function resetModule() {
    currmodule = new Module("root");
    context_stack = [];
    includes_stack = [];
    module_stack = [];
}