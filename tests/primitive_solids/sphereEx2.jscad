{ argnames: [ undefined, '$fn' ],
  argvalues: [],
  argexpr: 
   [ { children: [],
       const_value: 2,
       call_argnames: [],
       type: 'C',
       evaluate: [Function] },
     { children: [],
       const_value: 100,
       call_argnames: [],
       type: 'C',
       evaluate: [Function] } ],
  children: [],
  isSubmodule: false,
  evaluate: [Function],
  name: 'sphere' }
function main(){


return CSG.sphere({center: [0,0,0], radius: 2, resolution: 100});
};
