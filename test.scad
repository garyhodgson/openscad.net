
module spring(r1 = 100, r2 = 10, h = 100, hr = 12)
{
  stepsize = 1/16;
  module segment(i1, i2) {
    alpha1 = i1 * 360*r2/hr;
    alpha2 = i2 * 360*r2/hr;
    len1 = sin(acos(i1*2-1))*r2;
    len2 = sin(acos(i2*2-1))*r2;

    if (len1 < 0.01) {
      polygon([
        [ cos(alpha1)*r1, sin(alpha1)*r1 ],
        [ cos(alpha2)*(r1-len2), sin(alpha2)*(r1-len2) ],
        [ cos(alpha2)*(r1+len2), sin(alpha2)*(r1+len2) ]
      ]);
      }
    if (len2 < 0.01) {
      polygon([
        [ cos(alpha1)*(r1+len1), sin(alpha1)*(r1+len1) ],
        [ cos(alpha1)*(r1-len1), sin(alpha1)*(r1-len1) ],
        [ cos(alpha2)*r1, sin(alpha2)*r1 ],
      ]);
      }
    if (len1 >= 0.01 && len2 >= 0.01) {
      polygon([
        [ cos(alpha1)*(r1+len1), sin(alpha1)*(r1+len1) ],
        [ cos(alpha1)*(r1-len1), sin(alpha1)*(r1-len1) ],
        [ cos(alpha2)*(r1-len2), sin(alpha2)*(r1-len2) ],
        [ cos(alpha2)*(r1+len2), sin(alpha2)*(r1+len2) ]
      ]);
      }
  }
  linear_extrude(height = 100, twist = 180*h/hr,
      $fn = (hr/r2)/stepsize, convexity = 5) {
    for (i = [ stepsize : stepsize : 1+stepsize/2 ]) {
      segment(i-stepsize, min(i, 1));
    }
  }
}

spring();