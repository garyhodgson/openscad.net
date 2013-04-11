include <configuration.scad>
    
cube_fillet([10, 35, y_belt_center-(belt_width+3)/2], center = true, radius=3, $fn=12);
