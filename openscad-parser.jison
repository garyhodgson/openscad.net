
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
"$"?[a-zA-Z0-9_]+           return 'TOK_ID'
{D}+{E}?                    return 'TOK_NUMBER'

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
