module step(mod)
{
	echo(mod);
	translate([2*mod,0,0])
	cube(mod);
}

for (i = [1:2])
{
  step(i);
}
