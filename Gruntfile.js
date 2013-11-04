/* jshint node: true */

module.exports = function(grunt) {
  "use strict";

  RegExp.quote = require('regexp-quote')
  var btoa = require('btoa')
  // Project configuration.
  grunt.initConfig({

    // Metadata.
    pkg: grunt.file.readJSON('package.json'),
    banner: '/*!\n' +
              ' * Bootstrap v<%= pkg.version %> by @fat and @mdo\n' +
              ' * Copyright <%= grunt.template.today("yyyy") %> <%= pkg.author %>\n' +
              ' * Licensed under <%= _.pluck(pkg.licenses, "url").join(", ") %>\n' +
              ' *\n' +
              ' * Designed and built with all the love in the world by @mdo and @fat.\n' +
              ' */\n\n',
    jqueryCheck: 'if (typeof jQuery === "undefined") { throw new Error("Bootstrap requires jQuery") }\n\n',

    // Task configuration.
    clean: {
      dist: ['dist']
    },

    jshint: {
      options: {
        jshintrc: 'js/.jshintrc'
      },
      gruntfile: {
        src: 'Gruntfile.js'
      },
      src: {
        src: ['js/*.js']
      },
      test: {
        src: ['js/tests/unit/*.js']
      }
    },

    concat: {
      options: {
        banner: '<%= banner %><%= jqueryCheck %>',
        stripBanners: false
      },
      bootstrap: {
        src: [
          'js/transition.js',
          'js/alert.js',
          'js/button.js',
          'js/carousel.js',
          'js/collapse.js',
          'js/dropdown.js',
          'js/modal.js',
          'js/tooltip.js',
          'js/popover.js',
          'js/scrollspy.js',
          'js/tab.js',
          'js/affix.js'
        ],
        dest: 'dist/js/<%= pkg.name %>.js'
      }
    },

    uglify: {
      options: {
        banner: '<%= banner %>',
        report: 'min'
      },
      bootstrap: {
        src: ['<%= concat.bootstrap.dest %>'],
        dest: 'dist/js/<%= pkg.name %>.min.js'
      }
    },

    recess: {
      options: {
        compile: true,
        banner: '<%= banner %>'
      },
      bootstrap: {
        src: ['less/bootstrap.less'],
        dest: 'dist/css/<%= pkg.name %>.css'
      },
      min: {
        options: {
          compress: true
        },
        src: ['less/bootstrap.less'],
        dest: 'dist/css/<%= pkg.name %>.min.css'
      },
      theme: {
        src: ['less/theme.less'],
        dest: 'dist/css/<%= pkg.name %>-theme.css'
      },
      theme_min: {
        options: {
          compress: true
        },
        src: ['less/theme.less'],
        dest: 'dist/css/<%= pkg.name %>-theme.min.css'
      }
    },

    copy: {
      fonts: {
        expand: true,
        src: ["fonts/*"],
        dest: 'dist/'
      }
    },

    qunit: {
      options: {
        inject: 'js/tests/unit/phantom.js'
      },
      files: ['js/tests/*.html']
    },

    connect: {
      server: {
        options: {
          port: 3000,
          base: '.'
        }
      }
    },

    jekyll: {
      docs: {}
    },

    jade: {
      compile: {
        options: {
          pretty: true,
          data: function (dest, src) {
            /*
            Mini-language:
              //== This is a normal heading, which starts a section. Sections group variables together.
              //## Optional description for the heading

              //** Optional description for the following variable. You **can** use Markdown in descriptions to discuss `<html>` stuff.
              @foo: #ffff;

              //-- This is a heading for a section whose variables shouldn't be customizable

              All other lines are ignored completely.
            */
            var path = require('path');
            var fs = require('fs');
            var markdown = require('markdown').markdown;

            var filePath = path.join(__dirname, 'less/variables.less');
            var lines = fs.readFileSync(filePath, {encoding: 'utf8'}).split('\n');

            function Section(heading, customizable) {
              this.heading = heading.trim();
              this.id = this.heading.replace(/\s+/g, '-').toLowerCase();
              this.customizable = customizable;
              this.docstring = null;
              this.variables = [];
              this.addVar = function (variable) {
                this.variables.push(variable);
              };
            }
            function markdown2html(markdownString) {
              // the slice removes the <p>...</p> wrapper output by Markdown processor
              return markdown.toHTML(markdownString.trim()).slice(3, -4);
            }
            function VarDocstring(markdownString) {
              this.html = markdown2html(markdownString);
            }
            function SectionDocstring(markdownString) {
              this.html = markdown2html(markdownString);
            }
            function Variable(name, defaultValue) {
              this.name = name;
              this.defaultValue = defaultValue;
              this.docstring = null;
            }
            function Tokenizer() {
              this.CUSTOMIZABLE_HEADING = /^[/]{2}={2}(.*)$/;
              this.UNCUSTOMIZABLE_HEADING = /^[/]{2}-{2}(.*)$/;
              this.SECTION_DOCSTRING = /^[/]{2}#{2}(.*)$/;
              this.VAR_ASSIGNMENT = /^(@[a-zA-Z0-9_-]+):[ ]*([^ ;][^;]+);[ ]*$/;
              this.VAR_DOCSTRING = /^[/]{2}[*]{2}(.*)$/;

              this._next = undefined;
            }
            Tokenizer.prototype.unshift = function (token) {
              if (this._next !== undefined) {
                throw new Error("Attempted to unshift twice!");
              }
              this._next = token;
            };
            Tokenizer.prototype._shift = function () {
              // returning null signals EOF
              // returning undefined means the line was ignored
              if (this._next !== undefined) {
                var result = this._next;
                this._next = undefined;
                return result;
              }
              if (lines.length <= 0) {
                return null;
              }
              var line = lines.shift();
              var match = null;
              match = this.CUSTOMIZABLE_HEADING.exec(line);
              if (match !== null) {
                return new Section(match[1], true);
              }
              match = this.UNCUSTOMIZABLE_HEADING.exec(line);
              if (match !== null) {
                return new Section(match[1], false);
              }
              match = this.SECTION_DOCSTRING.exec(line);
              if (match !== null) {
                return new SectionDocstring(match[1]);
              }
              match = this.VAR_DOCSTRING.exec(line);
              if (match !== null) {
                return new VarDocstring(match[1]);
              }
              var commentStart = line.lastIndexOf("//");
              var varLine = (commentStart === -1) ? line : line.slice(0, commentStart);
              match = this.VAR_ASSIGNMENT.exec(varLine);
              if (match !== null) {
                return new Variable(match[1], match[2]);
              }
              return undefined;
            };
            Tokenizer.prototype.shift = function () {
              while (true) {
                var result = this._shift();
                if (result === undefined) {
                  continue;
                }
                return result;
              }
            };
            var tokenizer = new Tokenizer();
            function Parser() {}
            Parser.prototype.parseFile = function () {
              var sections = [];
              while (true) {
                var section = this.parseSection();
                if (section === null) {
                  if (tokenizer.shift() !== null) {
                    throw new Error("Unexpected unparsed section of file remains!");
                  }
                  return sections;
                }
                sections.push(section);
              }
            };
            Parser.prototype.parseSection = function () {
              var section = tokenizer.shift();
              if (section === null) {
                return null;
              }
              if (!(section instanceof Section)) {
                throw new Error("Expected section heading; got: " + JSON.stringify(section));
              }
              var docstring = tokenizer.shift();
              if (docstring instanceof SectionDocstring) {
                section.docstring = docstring;
              }
              else {
                tokenizer.unshift(docstring);
              }
              this.parseVars(section);
              return section;
            };
            Parser.prototype.parseVars = function (section) {
              while (true) {
                var variable = this.parseVar();
                if (variable === null) {
                  return;
                }
                section.addVar(variable);
              }
            };
            Parser.prototype.parseVar = function () {
              var docstring = tokenizer.shift();
              if (!(docstring instanceof VarDocstring)) {
                tokenizer.unshift(docstring);
                docstring = null;
              }
              var variable = tokenizer.shift();
              if (variable instanceof Variable) {
                variable.docstring = docstring;
                return variable;
              }
              tokenizer.unshift(variable);
              return null;
            };

            return {sections: (new Parser()).parseFile()};
          }
        },
        files: {
          '_includes/customizer-variables.html': 'customizer-variables.jade'
        }
      }
    },

    validation: {
      options: {
        reset: true,
        relaxerror: [
            "Bad value X-UA-Compatible for attribute http-equiv on element meta.",
            "Element img is missing required attribute src."
        ]
      },
      files: {
        src: ["_gh_pages/**/*.html"]
      }
    },

    watch: {
      src: {
        files: '<%= jshint.src.src %>',
        tasks: ['jshint:src', 'qunit']
      },
      test: {
        files: '<%= jshint.test.src %>',
        tasks: ['jshint:test', 'qunit']
      },
      recess: {
        files: 'less/*.less',
        tasks: ['recess']
      }
    },

    sed: {
      versionNumber: {
        pattern: (function () {
          var old = grunt.option('oldver')
          return old ? RegExp.quote(old) : old
        })(),
        replacement: grunt.option('newver'),
        recursive: true
      }
    }
  });


  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('browserstack-runner');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-jade');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-qunit');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-html-validation');
  grunt.loadNpmTasks('grunt-jekyll');
  grunt.loadNpmTasks('grunt-recess');
  grunt.loadNpmTasks('grunt-sed');

  // Docs HTML validation task
  grunt.registerTask('validate-html', ['jekyll', 'validation']);

  // Test task.
  var testSubtasks = ['dist-css', 'jshint', 'qunit', 'build-customizer-vars-form', 'validate-html'];
  // Only run BrowserStack tests under Travis
  if (process.env.TRAVIS) {
    // Only run BrowserStack tests if this is a mainline commit in twbs/bootstrap, or you have your own BrowserStack key
    if ((process.env.TRAVIS_REPO_SLUG === 'twbs/bootstrap' && process.env.TRAVIS_PULL_REQUEST === 'false') || process.env.TWBS_HAVE_OWN_BROWSERSTACK_KEY) {
      testSubtasks.push('browserstack_runner');
    }
  }
  grunt.registerTask('test', testSubtasks);

  // JS distribution task.
  grunt.registerTask('dist-js', ['concat', 'uglify']);

  // CSS distribution task.
  grunt.registerTask('dist-css', ['recess']);

  // Fonts distribution task.
  grunt.registerTask('dist-fonts', ['copy']);

  // Full distribution task.
  grunt.registerTask('dist', ['clean', 'dist-css', 'dist-fonts', 'dist-js']);

  // Default task.
  grunt.registerTask('default', ['test', 'dist', 'build-customizer']);

  // Version numbering task.
  // grunt change-version-number --oldver=A.B.C --newver=X.Y.Z
  // This can be overzealous, so its changes should always be manually reviewed!
  grunt.registerTask('change-version-number', ['sed']);

  // task for building customizer
  grunt.registerTask('build-customizer', ['build-customizer-vars-form', 'build-raw-files']);
  grunt.registerTask('build-customizer-vars-form', ['jade']);
  grunt.registerTask('build-raw-files', 'Add scripts/less files to customizer.', function () {
    var fs = require('fs')

    function getFiles(type) {
      var files = {}
      fs.readdirSync(type)
        .filter(function (path) {
          return type == 'fonts' ? true : new RegExp('\\.' + type + '$').test(path)
        })
        .forEach(function (path) {
          var fullPath = type + '/' + path
          return files[path] = (type == 'fonts' ? btoa(fs.readFileSync(fullPath)) : fs.readFileSync(fullPath, 'utf8'))
        })
      return 'var __' + type + ' = ' + JSON.stringify(files) + '\n'
    }

    var files = getFiles('js') + getFiles('less') + getFiles('fonts')
    fs.writeFileSync('docs-assets/js/raw-files.js', files)
  });
};
