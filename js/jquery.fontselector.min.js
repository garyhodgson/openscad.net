/**
 * Font Selector - jQuery plugin 0.1
 *
 * Copyright (c) 2012 Chris Dyer
 *
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following
 * conditions are met:
 *
 * Redistributions of source code must retain the above copyright notice, this list of conditions and the following
 * disclaimer. Redistributions in binary form must reproduce the above copyright notice, this list of conditions
 * and the following disclaimer in the documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING,
 * BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO
 * EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
 * SUCH DAMAGE.
 *
 */
(function(a){var c,g={init:function(b){c=a.extend({hide_fallbacks:!1,selected:function(){},initial:""},b);var f=this,d=this.find("ul");d.hide();var e=!1;""!=c.initial&&(c.hide_fallbacks?f.find("span").html(c.initial.substr(0,c.initial.indexOf(","))):f.find("span").html(c.initial),f.css("font-family",c.initial));d.find("li").each(function(){a(this).css("font-family",a(this).text());if(c.hide_fallbacks){var b=a(this).text();a(this).text(b.substr(0,b.indexOf(",")))}});d.find("li").click(function(){e&&
(d.slideUp("fast",function(){e=!1}),f.find("span").html(a(this).text()),f.css("font-family",a(this).css("font-family")),c.selected(a(this).css("font-family")))});a(this).click(function(a){e||(a.stopPropagation(),d.slideDown("fast",function(){e=!0}))});a("html").click(function(){e&&d.slideUp("fast",function(){e=!1})})},selected:function(){return this.css("font-family")}};a.fn.fontSelector=function(b){if(g[b])return g[b].apply(this,Array.prototype.slice.call(arguments,1));if("object"===typeof b||!b)return g.init.apply(this,
arguments);a.error("Method "+b+" does not exist on jQuery.fontSelector")}})(jQuery);