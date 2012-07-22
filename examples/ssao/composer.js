(function() {

    osgUtil.Composer = function() {
        osg.Node.call(this);
        this._stack = [];
        this._renderToScreen = false;

        var UpdateCallback = function() {

        };
        UpdateCallback.prototype = {
            update: function(node, nv) {
                if (node.isDirty()) {
                    node.build();
                }
            }
        };
        this.setUpdateCallback(new UpdateCallback());
    };

    osgUtil.Composer.prototype = osg.objectInehrit(osg.Node.prototype, {

        // arg0 can be a texture
        addPass: function(filter, arg0, arg1) {
            if (arg0 instanceof osg.Texture) {
                this._stack.push({ filter: filter, texture: arg0} );
            } else if ( arg0 !== undefined && arg1 !== undefined) {
                this._stack.push({ filter: filter, 
                                   width: arg0,
                                   height: arg1
                                 } );
            } else {
                this._stack.push({ filter: filter });
            }
        },
        renderToScreen: function(w,h) {
            this._renderToScreen = true;
            this._renderToScreenWidth = w;
            this._renderToScreenHeight = h;
        },

        isDirty: function() {
            for (var i = 0, l = this._stack.length; i < l; i++) {
                if (this._stack[i].filter.isDirty()) {
                    return true;
                }
            }
            return false;
        },

        build: function() {
            var root = this;
            this.removeChildren();
            var lastTextureResult;
            this._stack.forEach(function(element, i, array) {
                if (element.filter.isDirty()) {
                    element.filter.build();
                }
                var stateSet = element.filter.getStateSet();
                var w,h;
                if (element.texture !== undefined) {
                    w = element.texture.getWidth();
                    h = element.texture.getHeight();
                } else if ( element.width !== undefined && element.height !== undefined) {
                    w = element.width;
                    h = element.height;
                } else {
                    // get width from Texture0
                    var inputTexture = stateSet.getTextureAttribute(0, 'Texture');
                    if (inputTexture === undefined) {
                        osg.warn("osgComposer can't find any information to setup texture output size");
                    }
                    w = inputTexture.getWidth();
                    h = inputTexture.getHeight();
                }

                var vp = new osg.Viewport(0,0,w,h);
                var projection = osg.Matrix.makeOrtho(0,w,0,h,-5,5, []);

                var quad = osg.createTexturedQuadGeometry(0, 0, 0,
                                                          w, 0, 0,
                                                          0, h, 0);
                quad.setName("composer layer");
                var camera = new osg.Camera();
                camera.setReferenceFrame(osg.Transform.ABSOLUTE_RF);
                camera.setViewport(vp);
                camera.setProjectionMatrix(projection);
                var texture = element.texture;
                if (texture === undefined) {
                    texture = new osg.Texture();
                    texture.setTextureSize(w,h);
                }
                camera.setRenderOrder(osg.Camera.PRE_RENDER, 0);
                camera.attachTexture(osg.FrameBufferObject.COLOR_ATTACHMENT0, texture, 0);
                camera.setComputeNearFar(false);

                lastTextureResult = texture;

                // assign the result texture to the next stateset
                if (i+1 < array.length) {
                    array[i+1].filter.getStateSet().setTextureAttributeAndModes(0, lastTextureResult);
                }

                camera.addChild(quad);
                camera.setStateSet(element.filter.getStateSet());
                element.filter.getStateSet().addUniform(osg.Uniform.createFloat2([w,h],'RenderSize'));
                camera.setName("Composer Pass" + i);
                root.addChild(camera);
            });
            this._resultTexture = lastTextureResult;

            if (this._renderToScreen) {
                var w,h;
                w = this._renderToScreenWidth;
                h = this._renderToScreenHeight;
                var vp = new osg.Viewport(0,0, w, h);
                var projection = osg.Matrix.makeOrtho(0,w,0,h,-5,5, []);
                var quad = osg.createTexturedQuadGeometry(0, 0, 0,
                                                          w, 0, 0,
                                                          0, h, 0);
                quad.getOrCreateStateSet().setTextureAttributeAndModes(0, this._resultTexture);

                var vertexshader = [
                    "#ifdef GL_ES",
                    "precision highp float;",
                    "#endif",
                    "attribute vec3 Vertex;",
                    "attribute vec2 TexCoord0;",
                    "varying vec2 FragTexCoord0;",
                    "uniform mat4 ModelViewMatrix;",
                    "uniform mat4 ProjectionMatrix;",
                    "vec4 ftransform() {",
                    "  return ProjectionMatrix * ModelViewMatrix * vec4(Vertex, 1.0);",
                    "}",
                    "",
                    "void main(void) {",
                    "  gl_Position = ftransform();",
                    "  FragTexCoord0 = TexCoord0;",
                    "}"
                ].join('\n');
                var fragmentshader = [
                    "#ifdef GL_ES",
                    "precision highp float;",
                    "#endif",
                    "uniform sampler2D Texture0;",
                    "varying vec2 FragTexCoord0;",
                    "void main(void) {",
                    "gl_FragColor = texture2D(Texture0, FragTexCoord0);",
                    "}"
                ].join('\n');

                var program = new osg.Program(new osg.Shader(gl.VERTEX_SHADER, vertexshader),
                                              new osg.Shader(gl.FRAGMENT_SHADER, fragmentshader));
                quad.getOrCreateStateSet().setAttributeAndModes(program);

                var camera = new osg.Camera();
                camera.setReferenceFrame(osg.Transform.ABSOLUTE_RF);
                camera.setViewport(vp);
                camera.setProjectionMatrix(projection);
                camera.addChild(quad);
                root.addChild(camera);
            }
        }
    });

    osgUtil.Composer.Filter = function() {
        this._stateSet = new osg.StateSet();
        this._dirty = true;
    };

    osgUtil.Composer.Filter.prototype = {
        getStateSet: function() { return this._stateSet;},
        dirty: function() { this._dirty = true;},
        isDirty: function() { return this._dirty;}
    };


    osgUtil.Composer.Filter.defaultVertexShader = [
        "#ifdef GL_ES",
        "precision highp float;",
        "#endif",
        "attribute vec3 Vertex;",
        "attribute vec2 TexCoord0;",
        "varying vec2 FragTexCoord0;",
        "uniform mat4 ModelViewMatrix;",
        "uniform mat4 ProjectionMatrix;",
        "void main(void) {",
        "  gl_Position = ProjectionMatrix * ModelViewMatrix * vec4(Vertex,1.0);",
        "  FragTexCoord0 = TexCoord0;",
        "}",
        ""
    ].join('\n');

    osgUtil.Composer.Filter.defaultFragmentShaderHeader = [
        "#ifdef GL_ES",
        "precision highp float;",
        "#endif",
        "varying vec2 FragTexCoord0;",
        "uniform vec2 RenderSize;",
        "uniform sampler2D Texture0;",
        ""
    ].join('\n');

    osgUtil.Composer.Filter.Helper = {
        getOrCreatePascalCoefficients: function() {
            var cache = osgUtil.Composer.Filter.Helper.getOrCreatePascalCoefficients.cache;
            if (cache !== undefined) {
                return cache;
            }

            cache = (function(kernelSize) {
                var pascalTriangle = [ [1] ];
                for (var j = 0; j < (kernelSize-1); j++) {
                    var sum = Math.pow(2,j);
                    var currentRow = pascalTriangle[j];
                    var currentRowSize = currentRow.length;

                    var nextRowSize = currentRowSize+1;
                    var nextRow = new Array(currentRowSize);
                    nextRow[0] = 1.0;
                    nextRow[nextRowSize-1] = 1.0;

                    var idx = 1;
                    for (var p = 0; p < currentRowSize-1; p++) {
                        var val = (currentRow[p]+currentRow[p+1]);
                        nextRow[idx++] = val;
                    }
                    pascalTriangle.push(nextRow);
                }

                // compute real coef dividing by sum
                (function() {
                    for (var a = 0; a < pascalTriangle.length; a++) {
                        var row = pascalTriangle[a];
                        //var str = "";
                        
                        var sum = Math.pow(2,a);
                        for (var i = 0; i < row.length; i++) {
                            row[i] = row[i]/sum;
                            //str += row[i].toString() + " ";
                        }
                        //console.log(str);
                    }
                })();

                return pascalTriangle;
            })(20);
            osgUtil.Composer.Filter.Helper.getOrCreatePascalCoefficients.cache = cache;
            return cache;
        }
    };

    osgUtil.Composer.Filter.HBlur = function(nbSamplesOpt) {
        osgUtil.Composer.Filter.call(this);
        if (nbSamplesOpt === undefined) {
            this.setBlurSize(5);
        } else {
            this.setBlurSize(nbSamplesOpt);
        }
    };
    
    osgUtil.Composer.Filter.HBlur.prototype = osg.objectInehrit(osgUtil.Composer.Filter.prototype, {
        setBlurSize: function(nbSamples) {
            if (nbSamples%2 !== 1) {
                nbSamples+=1;
            }
            this._nbSamples = nbSamples;
            this.dirty();
        },
        build: function() {
            var nbSamples = this._nbSamples;
            var vtx = osgUtil.Composer.Filter.defaultVertexShader;
            var pascal = osgUtil.Composer.Filter.Helper.getOrCreatePascalCoefficients();
            var weights = pascal[nbSamples-1];
            var start = Math.floor(nbSamples/2.0);
            var kernel = [];
            kernel.push(" pixel += float("+weights[start]+")*texture2D(Texture0, FragTexCoord0 ).rgb;");
            var offset = 1;
            kernel.push(" vec2 offset;");
            for (var i = start+1; i < nbSamples; i++) {
                var weight = weights[i];
                kernel.push(" offset = vec2("+offset+".0/RenderSize[0],0.0);");
                offset++;
                kernel.push(" pixel += "+weight+"*texture2D(Texture0, FragTexCoord0 + offset).rgb;");
                kernel.push(" pixel += "+weight+"*texture2D(Texture0, FragTexCoord0 - offset).rgb;");
            }

            var fgt = [
                osgUtil.Composer.Filter.defaultFragmentShaderHeader,
                "uniform float width;",

                "void main (void)",
                "{",
                "  vec3 pixel;",
                kernel.join('\n'),
                "  gl_FragColor = vec4(pixel,1.0);",
                "}",
                ""
            ].join('\n');

            var program = new osg.Program(
                new osg.Shader(gl.VERTEX_SHADER, vtx),
                new osg.Shader(gl.FRAGMENT_SHADER, fgt));

            if (this._stateSet.getUniform('Texture0') === undefined) {
                this._stateSet.addUniform(osg.Uniform.createInt1(0,'Texture0'));
            }
            this._stateSet.setAttributeAndModes(program);
            this._dirty = false;
        }
    });



    osgUtil.Composer.Filter.AverageHBlur = function(nbSamplesOpt) {
        osgUtil.Composer.Filter.call(this);
        if (nbSamplesOpt === undefined) {
            this.setBlurSize(5);
        } else {
            this.setBlurSize(nbSamplesOpt);
        }
    };
    
    osgUtil.Composer.Filter.AverageHBlur.prototype = osg.objectInehrit(osgUtil.Composer.Filter.prototype, {
        setBlurSize: function(nbSamples) {
            if (nbSamples%2 !== 1) {
                nbSamples+=1;
            }
            this._nbSamples = nbSamples;
            this.dirty();
        },
        getShaderBlurKernel: function() {
            var nbSamples = this._nbSamples;
            var kernel = [];
            kernel.push(" pixel = texture2D(Texture0, FragTexCoord0 );");
            kernel.push(" if (pixel.w == 0.0) { gl_FragColor = pixel; return; }");
            kernel.push(" vec2 offset;");
            for (var i = 1; i < Math.ceil(nbSamples/2); i++) {
                kernel.push(" offset = vec2("+i+".0/RenderSize[0],0.0);");
                kernel.push(" pixel += texture2D(Texture0, FragTexCoord0 + offset);");
                kernel.push(" pixel += texture2D(Texture0, FragTexCoord0 - offset);");
            }
            kernel.push(" pixel /= float(" + nbSamples + ");");
            return kernel;
        },
        build: function() {
            var nbSamples = this._nbSamples;
            var vtx = osgUtil.Composer.Filter.defaultVertexShader;
            var fgt = [
                osgUtil.Composer.Filter.defaultFragmentShaderHeader,
                "uniform float width;",

                "void main (void)",
                "{",
                "  vec4 pixel;",
                this.getShaderBlurKernel().join('\n'),
                "  gl_FragColor = vec4(pixel);",
                "}",
                ""
            ].join('\n');

            var program = new osg.Program(
                new osg.Shader(gl.VERTEX_SHADER, vtx),
                new osg.Shader(gl.FRAGMENT_SHADER, fgt));

            if (this._stateSet.getUniform('Texture0') === undefined) {
                this._stateSet.addUniform(osg.Uniform.createInt1(0,'Texture0'));
            }
            this._stateSet.setAttributeAndModes(program);
            this._dirty = false;
        }
    });


    osgUtil.Composer.Filter.AverageVBlur = function(nbSamplesOpt) {
        osgUtil.Composer.Filter.AverageHBlur.call(this);
    };
    
    osgUtil.Composer.Filter.AverageVBlur.prototype = osg.objectInehrit(osgUtil.Composer.Filter.AverageHBlur.prototype, {
        getShaderBlurKernel: function() {
            var nbSamples = this._nbSamples;
            var kernel = [];
            kernel.push(" pixel = texture2D(Texture0, FragTexCoord0 );");
            kernel.push(" if (pixel.w == 0.0) { gl_FragColor = pixel; return; }");            kernel.push(" vec2 offset;");
            for (var i = 1; i < Math.ceil(nbSamples/2); i++) {
                kernel.push(" offset = vec2(0.0,"+i+".0/RenderSize[1]);");
                kernel.push(" pixel += texture2D(Texture0, FragTexCoord0 + offset);");
                kernel.push(" pixel += texture2D(Texture0, FragTexCoord0 - offset);");
            }
            kernel.push(" pixel /= float(" + nbSamples + ");");
            return kernel;
        }
    });



    osgUtil.Composer.Filter.InputTexture = function(texture) {
        osgUtil.Composer.Filter.call(this);
        this._stateSet.setTextureAttributeAndModes(0, texture);
    };

    osgUtil.Composer.Filter.InputTexture.prototype = osg.objectInehrit(osgUtil.Composer.Filter.prototype, {
        build: function() {
            this._dirty = false;
        }
    });


    osgUtil.Composer.Filter.VBlur = function(nbSamplesOpt) {
        osgUtil.Composer.Filter.HBlur.call(this);
    };

    osgUtil.Composer.Filter.VBlur.prototype = osg.objectInehrit(osgUtil.Composer.Filter.HBlur.prototype, {

        build: function() {
            var nbSamples = this._nbSamples;
            var vtx = osgUtil.Composer.Filter.defaultVertexShader;
            var pascal = osgUtil.Composer.Filter.Helper.getOrCreatePascalCoefficients();
            var weights = pascal[nbSamples-1];
            var start = Math.floor(nbSamples/2.0);
            var kernel = [];
            kernel.push(" pixel += float("+ weights[start]+")*texture2D(Texture0, FragTexCoord0 ).rgb;");
            var offset = 1;
            kernel.push(" vec2 offset;");
            for (var i = start+1; i < nbSamples; i++) {
                var weight = weights[i];
                kernel.push(" offset = vec2(0.0, "+offset+".0/RenderSize[1]);");
                offset++;
                kernel.push(" pixel += "+weight+"*texture2D(Texture0, FragTexCoord0 + offset).rgb;");
                kernel.push(" pixel += "+weight+"*texture2D(Texture0, FragTexCoord0 - offset).rgb;");
            }

            var fgt = [
                "",
                osgUtil.Composer.Filter.defaultFragmentShaderHeader,
                "uniform float height;",

                "void main (void)",
                "{",
                "  vec3 pixel;",
                kernel.join('\n'),
                "  gl_FragColor = vec4(pixel,1.0);",
                "}",
                ""
            ].join('\n');

            var program = new osg.Program(
                new osg.Shader(gl.VERTEX_SHADER, vtx),
                new osg.Shader(gl.FRAGMENT_SHADER, fgt));

            if (this._stateSet.getUniform('Texture0') === undefined) {
                this._stateSet.addUniform(osg.Uniform.createInt1(0,'Texture0'));
            }
            this._stateSet.setAttributeAndModes(program);
            this._dirty = false;
        }
    });


    osgUtil.Composer.Filter.BlendMix = function() {
        osgUtil.Composer.Filter.call(this);
        var texture0,texture1,mixValue;
        var unit0 = 0;
        var unit1 = 1;
        var stateSet = this._stateSet;
        if (arguments.length === 3) {
            texture0 = arguments[0];
            texture1 = arguments[1];
            mixValue = arguments[2];
            unit0 = 1;
            unit1 = 2;
        stateSet.setTextureAttributeAndModes(unit0,texture0);
        } else if (arguments.length === 2) {
            texture1 = arguments[0];
            mixValue = arguments[1];
        } else if (arguments.length === 1) {
            texture1 = arguments[0];
            mixValue = 0.5;
        }
        stateSet.setTextureAttributeAndModes(unit1,texture1);
        stateSet.addUniform(osg.Uniform.createInt1(unit0,'Texture0'));
        stateSet.addUniform(osg.Uniform.createInt1(unit1,'Texture1'));
        this._mixValueUniform = osg.Uniform.createFloat1(mixValue,'MixValue');
        stateSet.addUniform(mixValueUniform);
    };

    osgUtil.Composer.Filter.BlendMix = osg.objectInehrit(osgUtil.Composer.Filter.prototype, {
        getBlendFactorUniform: function() {
            return this._mixValueUniform;
        },

        build: function() {
            var stateSet = this._stateSet;
            var vtx = osgUtil.Composer.Filter.defaultVertexShader;
            var fgt = [
                "",
                osgUtil.Composer.Filter.defaultFragmentShaderHeader,
                "uniform sampler2D Texture1;",
                "uniform float MixValue;",

                "void main (void)",
                "{",
                "  gl_FragColor = mix(texture2D(Texture0,FragTexCoord0), texture2D(Texture1,FragTexCoord0),MixValue);",
                "}",
                ""
            ].join('\n');

            var program = new osg.Program(
                new osg.Shader(gl.VERTEX_SHADER, vtx),
                new osg.Shader(gl.FRAGMENT_SHADER, fgt));

            stateSet.setAttributeAndModes(program);
            this._dirty = false;
        }
    });


    osgUtil.Composer.Filter.BlendMultiply = function() {
        osgUtil.Composer.Filter.call(this);
        var stateSet = this._stateSet;
        var texture0,texture1,mixValue;
        var unit0 = 0;
        var unit1 = 1;
        if (arguments.length === 2) {
            texture0 = arguments[0];
            texture1 = arguments[1];
            unit0 = 1;
            unit0 = 2;
            stateSet.setTextureAttributeAndModes(unit0,texture0);
        } else if (arguments.length === 1) {
            texture1 = arguments[0];
        }
        stateSet.setTextureAttributeAndModes(unit1,texture1);
        stateSet.addUniform(osg.Uniform.createInt1(unit0,'Texture0'));
        stateSet.addUniform(osg.Uniform.createInt1(unit1,'Texture1'));
    };

    osgUtil.Composer.Filter.BlendMultiply.prototype = osg.objectInehrit(osgUtil.Composer.Filter.prototype, {
        build: function() {
            var vtx = osgUtil.Composer.Filter.defaultVertexShader;
            var fgt = [
                "",
                osgUtil.Composer.Filter.defaultFragmentShaderHeader,
                "uniform sampler2D Texture1;",
                "uniform float MixValue;",

                "void main (void)",
                "{",
                "  gl_FragColor = texture2D(Texture0,FragTexCoord0)*texture2D(Texture1,FragTexCoord0);",
                "}",
                ""
            ].join('\n');

            var program = new osg.Program(
                new osg.Shader(gl.VERTEX_SHADER, vtx),
                new osg.Shader(gl.FRAGMENT_SHADER, fgt));

            this._stateSet.setAttributeAndModes(program);
            this._dirty = false;
        }
    });

    osgUtil.Composer.Filter.SSAO = function(options) {
        osgUtil.Composer.Filter.call(this);

        var stateSet = this._stateSet;
        var nbSamples = 16;
        var radius = 0.05;
        if (options !== undefined) {
            if (options.nbSamples !== undefined)
                nbSamples = options.nbSamples;

            if (options.radius !== undefined)
                radius = options.radius;
        }

        var textureNormal = options.normal;
        var texturePosition = options.position;
        this._radius = radius;
        this._nbSamples = nbSamples;
        this._noiseTextureSize = 16;
        stateSet.addUniform(osg.Uniform.createFloat1(1.0,'Power'));
        stateSet.addUniform(osg.Uniform.createFloat1(radius,'Radius'));
        stateSet.addUniform(osg.Uniform.createInt1(0,'Texture0'));
        stateSet.addUniform(osg.Uniform.createInt1(1,'Texture1'));
        stateSet.addUniform(osg.Uniform.createInt1(2,'Texture2'));

        var w = textureNormal.getWidth();
        var h = textureNormal.getHeight();
        this._size = [w,h];

        stateSet.setTextureAttributeAndModes(0,textureNormal);
        stateSet.setTextureAttributeAndModes(1,texturePosition);

        this._angleLimit = 0.3;
        this._sceneRadius = 2.0;
    };

    osgUtil.Composer.Filter.SSAO.prototype = osg.objectInehrit(osgUtil.Composer.Filter.prototype, {
        setSceneRadius: function(value) {
            this._sceneRadius = value;
            this.dirty();
        },
        build: function() {
            var stateSet = this._stateSet;
            var nbSamples = this._nbSamples;
            var kernel = new Array(nbSamples*4);
            var angleLimit = this._angleLimit;
            (function(array) {
                for (var i = 0; i < nbSamples; i++) {
                    var x,y,z;
                    x = 2.0*(Math.random()-0.5);
                    y = 2.0*(Math.random()-0.5);
                    z = Math.max(angleLimit,Math.random());

                    var v = osg.Vec3.normalize([x,y,z],[]);
                    var scale = Math.max(i/nbSamples,0.1);
                    //scale = 0.1+(1.0-0.1)*(scale*scale);
                    array[i*3+0] = v[0];
                    array[i*3+1] = v[1];
                    array[i*3+2] = v[2];
                    array[i*3+3] = scale;
                }
            })(kernel);

            var sizeNoise = this._noiseTextureSize;
            var noise = new Array(sizeNoise*sizeNoise*3);
            (function(array) {
                for (var i = 0; i < sizeNoise*sizeNoise; i++) {
                    var x,y,z;
                    x = 2.0*(Math.random()-0.5);
                    y = 2.0*(Math.random()-0.5);
                    z = 0.0;

                    var n = osg.Vec3.normalize([x,y,z],[]);
                    array[i*3+0] = 255*(n[0]*0.5+0.5);
                    array[i*3+1] = 255*(n[1]*0.5+0.5);
                    array[i*3+2] = 255*(n[2]*0.5+0.5);
                }
            })(noise);


            var noiseShader = [];
            noiseShader.push("vec2 rand(in vec2 coord) { //generating random noise");
            noiseShader.push("float noiseX = (fract(sin(dot(coord ,vec2(12.9898,78.233))) * 43758.5453));");
            noiseShader.push("float noiseY = (fract(sin(dot(coord ,vec2(12.9898,78.233)*2.0)) * 43758.5453));");
            noiseShader.push("return vec2(noiseX,noiseY)*0.002;");
            noiseShader.push("}");

            var noiseTexture = new osg.Texture();
            noiseTexture.setWrapS('REPEAT');
            noiseTexture.setWrapT('REPEAT');
            noiseTexture.setMinFilter('NEAREST');
            noiseTexture.setMagFilter('NEAREST');
            
            noiseTexture.setTextureSize(sizeNoise,sizeNoise);
            noiseTexture.setImage(new Uint8Array(noise),'RGB');
            stateSet.setTextureAttributeAndModes(2,noiseTexture);
            var uniform = stateSet.getUniform('noiseSampling');
            if (uniform === undefined) {
                uniform = osg.Uniform.createFloat2([this._size[0]/this._noiseTextureSize, this._size[1]/this._noiseTextureSize],'noiseSampling');
                stateSet.addUniform(uniform);
            } else {
                uniform.set([this._size[0]/this._noiseTextureSize, this._size[1]/this._noiseTextureSize]);
                uniform.dirty();
            }
            var vertexshader = [
                "",
                "#ifdef GL_ES",
                "precision highp float;",
                "#endif",
                "attribute vec3 Vertex;",
                "attribute vec2 TexCoord0;",
                "varying vec2 FragTexCoord0;",
                "uniform mat4 ModelViewMatrix;",
                "uniform mat4 ProjectionMatrix;",
                "void main(void) {",
                "  gl_Position = ProjectionMatrix * ModelViewMatrix * vec4(Vertex,1.0);",
                "  FragTexCoord0 = TexCoord0;",
                "}",
                ""
            ].join('\n');

            var kernelglsl = [];
            for (var i = 0; i < nbSamples; i++) {
                kernelglsl.push("kernel["+i+"] = vec4("+kernel[i*3]+"," + kernel[i*3+1] + ", " + kernel[i*3+2] +", " + kernel[i*3+3] + ");");
            }
            kernelglsl = kernelglsl.join('\n');

            var ssaoRadiusMin = this._sceneRadius*0.005;
            var ssaoRadiusMax = this._sceneRadius*0.05;
            var ssaoRadiusStep = (ssaoRadiusMax-ssaoRadiusMin)/200.0;

            var fragmentshader = [
                "",
                osgUtil.Composer.Filter.defaultFragmentShaderHeader,
                "uniform sampler2D Texture1;",
                "uniform sampler2D Texture2;",
                "uniform mat4 projection;",
                "uniform vec2 noiseSampling;",
                "uniform float Power; //"+ '{ "min": 0.1, "max": 8.0, "step": 0.1, "value": [1.0] }',
                "uniform float Radius; //"+ '{ "min": ' + ssaoRadiusMin +', "max": ' + ssaoRadiusMax + ', "step": '+ ssaoRadiusStep + ', "value": [0.01] }',

                "#define NB_SAMPLES " + this._nbSamples,
                "float depth;",
                "vec3 normal;",
                "vec4 position;",
                "vec4 kernel["+nbSamples+"];",
                noiseShader.join('\n'),
                "mat3 computeBasis()",
                "{",
                "  vec2 uvrand = FragTexCoord0*noiseSampling;",
                "  //uvrand = rand(gl_FragCoord.xy);",
                "  vec3 rvec = texture2D(Texture2, uvrand*2.0).xyz*2.0-vec3(1.0);",
                "  //vec3 rvec = normalize(vec3(uvrand,0.0));",
                "  vec3 tangent = normalize(rvec - normal * dot(rvec, normal));",
                "  vec3 bitangent = cross(normal, tangent);",
                "  mat3 tbn = mat3(tangent, bitangent, normal);",
                "  return tbn;",
                "}",

                "void main (void)",
                "{",
                kernelglsl,
                "  position = texture2D(Texture1, FragTexCoord0);",
                "  vec4 p = texture2D(Texture0, FragTexCoord0);",
                "  depth = p.w;",
                "  normal = vec3(p);",
                "  if ( position.w == 0.0) {",
                "     gl_FragColor = vec4(1.0,1.0,1.0,0.0);",
                "     return;",
                "  }",
                "",
                " mat3 tbn = computeBasis();",
                " float occlusion = 0.0;",
                " for (int i = 0; i < NB_SAMPLES; i++) {",
                "    vec3 sample = tbn * vec3(kernel[i]);",
                "    vec3 dir = sample;",
                "    float w = dot(dir, normal);",
                "    float dist = 1.0-kernel[i].w;",
                "    w *= dist*dist*Power;",
                "    sample = dir * float(Radius) + position.xyz;",
                
                "    vec4 offset = projection * vec4(sample,1.0);",
                "    offset.xy /= offset.w;",
                "    offset.xy = offset.xy * 0.5 + 0.5;",

                "    float sample_depth = texture2D(Texture1, offset.xy).z;",
                "    float range_check = abs(sample.z - sample_depth) < float(Radius) ? 1.0 : 0.0;",
                "    occlusion += (sample_depth > sample.z ? 1.0 : 0.0) * range_check*w;",

                " }",
                " occlusion = 1.0 - (occlusion / float(NB_SAMPLES));",
                " gl_FragColor = vec4(vec3(occlusion),1.0);",
                "}",
                ""
            ].join('\n');

            var program = new osg.Program(
                new osg.Shader(gl.VERTEX_SHADER, vertexshader),
                new osg.Shader(gl.FRAGMENT_SHADER, fragmentshader));

            stateSet.setAttributeAndModes(program);
            this._dirty = false;
        }
    });


})();