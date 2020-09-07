const pkg = require("./package.json");
const path = require("path");
const glob = require("glob");
const yargs = require("yargs");
const colors = require("colors");

const { rollup } = require("rollup");
const { terser } = require("rollup-plugin-terser");
const babel = require("@rollup/plugin-babel").default;
const commonjs = require("@rollup/plugin-commonjs");
const resolve = require("@rollup/plugin-node-resolve").default;

const gulp = require("gulp");
const tap = require("gulp-tap");
const zip = require("gulp-zip");
const sass = require("gulp-sass");
const header = require("gulp-header");
const eslint = require("gulp-eslint");
const minify = require("gulp-clean-css");
const connect = require("gulp-connect");
const autoprefixer = require("gulp-autoprefixer");
const pug = require("gulp-pug");

const root = yargs.argv.root || "www";
const port = yargs.argv.port || 8000;

const banner = `/*!
* reveal.js ${pkg.version}
* ${pkg.homepage}
* MIT licensed
*
* Copyright (C) 2020 Hakim El Hattab, https://hakim.se
*/\n`;

// Prevents warnings from opening too many test pages
process.setMaxListeners(20);

const babelConfig = {
  babelHelpers: "bundled",
  ignore: ["node_modules"],
  compact: false,
  extensions: [".js", ".html"],
  plugins: ["transform-html-import-to-string"],
  presets: [
    [
      "@babel/preset-env",
      {
        corejs: 3,
        useBuiltIns: "usage",
        modules: false,
      },
    ],
  ],
};

// Our ES module bundle only targets newer browsers with
// module support. Browsers are targeted explicitly instead
// of using the "esmodule: true" target since that leads to
// polyfilling older browsers and a larger bundle.
const babelConfigESM = JSON.parse(JSON.stringify(babelConfig));
babelConfigESM.presets[0][1].targets = {
  browsers: [
    "last 2 Chrome versions",
    "not Chrome < 60",
    "last 2 Safari versions",
    "not Safari < 10.1",
    "last 2 iOS versions",
    "not iOS < 10.3",
    "last 2 Firefox versions",
    "not Firefox < 60",
    "last 2 Edge versions",
    "not Edge < 16",
  ],
};

let cache = {};

// Creates a bundle with broad browser support, exposed
// as UMD
gulp.task("js-es5", () => {
  return rollup({
    cache: cache.umd,
    input: "js/index.js",
    plugins: [resolve(), commonjs(), babel(babelConfig), terser()],
  }).then((bundle) => {
    cache.umd = bundle.cache;
    return bundle.write({
      name: "Reveal",
      file: "./dist/reveal.js",
      format: "umd",
      banner: banner,
      sourcemap: true,
    });
  });
});

// Creates an ES module bundle
gulp.task("js-es6", () => {
  return rollup({
    cache: cache.esm,
    input: "js/index.js",
    plugins: [resolve(), commonjs(), babel(babelConfigESM), terser()],
  }).then((bundle) => {
    cache.esm = bundle.cache;
    return bundle.write({
      file: "./dist/reveal.esm.js",
      format: "es",
      banner: banner,
      sourcemap: true,
    });
  });
});
gulp.task("js", gulp.parallel("js-es5", "js-es6"));

gulp.task("pug", function () {
  return gulp
    .src("src/templates/**/*.pug")
    .pipe(
      pug({
        doctype: "html",
        pretty: false,
        data: {
          title: "Nice2Know Session | LUKB DEVCADEMY",
          sessionID: null,
          masterSecret: null,
        },
      })
    )
    .pipe(gulp.dest("./www"));
});

// Creates a UMD and ES module bundle for each of our
// built-in plugins
gulp.task("plugins", () => {
  return Promise.all(
    [
      {
        name: "RevealHighlight",
        input: "./src/reveal/plugin/highlight/plugin.js",
        output: "./www/reveal/plugin/highlight/highlight",
      },
      {
        name: "RevealMarkdown",
        input: "./src/reveal/plugin/markdown/plugin.js",
        output: "./www/reveal/plugin/markdown/markdown",
      },
      {
        name: "RevealSearch",
        input: "./src/reveal/plugin/search/plugin.js",
        output: "./www/reveal/plugin/search/search",
      },
      {
        name: "RevealNotes",
        input: "./src/reveal/plugin/notes/plugin.js",
        output: "./www/reveal/plugin/notes/notes",
      },
      {
        name: "RevealZoom",
        input: "./src/reveal/plugin/zoom/plugin.js",
        output: "./www/reveal/plugin/zoom/zoom",
      },
      {
        name: "RevealMath",
        input: "./src/reveal/plugin/math/plugin.js",
        output: "./www/reveal/plugin/math/math",
      },
    ].map((plugin) => {
      return rollup({
        cache: cache[plugin.input],
        input: plugin.input,
        plugins: [
          resolve(),
          commonjs(),
          babel({
            ...babelConfig,
            ignore: [/node_modules\/(?!(highlight\.js|marked)\/).*/],
          }),
          terser(),
        ],
      }).then((bundle) => {
        cache[plugin.input] = bundle.cache;
        bundle.write({
          file: plugin.output + ".esm.js",
          name: plugin.name,
          format: "es",
        });

        bundle.write({
          file: plugin.output + ".js",
          name: plugin.name,
          format: "umd",
        });
      });
    })
  );
});

gulp.task("css-themes", () =>
  gulp
    .src(["./src/reveal/css/theme/source/*.{sass,scss}"])
    .pipe(sass())
    .pipe(gulp.dest("./www/reveal/css/theme"))
);

gulp.task("css-core", () =>
  gulp
    .src(["src/reveal/css/reveal.scss"])
    .pipe(sass())
    .pipe(autoprefixer())
    .pipe(minify({ compatibility: "ie9" }))
    .pipe(header(banner))
    .pipe(gulp.dest("./www/reveal/css"))
);

gulp.task("css", gulp.parallel("css-themes", "css-core"));

gulp.task("eslint", () =>
  gulp
    .src(["./src/reveal/js/**", "gulpfile.js"])
    .pipe(eslint())
    .pipe(eslint.format())
);

gulp.task("test", gulp.series("eslint"));

gulp.task(
  "default",
  gulp.series(gulp.parallel("js", "css", "plugins"), "test")
);

gulp.task("build", gulp.parallel("js", "css", "plugins"));

gulp.task(
  "package",
  gulp.series("default", () =>
    gulp
      .src([
        "./index.html",
        "./dist/**",
        "./lib/**",
        "./images/**",
        "./plugin/**",
        "./**.md",
      ])
      .pipe(zip("reveal-js-presentation.zip"))
      .pipe(gulp.dest("./"))
  )
);

gulp.task("reload", () => gulp.src(["*.html", "*.md"]).pipe(connect.reload()));

gulp.task("serve", () => {
  connect.server({
    root: root,
    port: port,
    host: "localhost",
    livereload: true,
  });

  gulp.watch(["src/templates/**/*.pug"], gulp.series("pug", "reload"));

  gulp.watch(["www/content/*.html", "www/content/*.md"], gulp.series("reload"));

  gulp.watch(["src/reveal/js/**"], gulp.series("js", "reload", "test"));

  gulp.watch(
    ["src/reveal/plugin/**/plugin.js"],
    gulp.series("plugins", "reload")
  );

  gulp.watch(
    [
      "src/reveal/css/theme/source/*.{sass,scss}",
      "src/reveal/css/theme/template/*.{sass,scss}",
    ],
    gulp.series("css-themes", "reload")
  );

  gulp.watch(
    ["src/reveal/css/*.scss", "src/reveal/css/print/*.{sass,scss,css}"],
    gulp.series("css-core", "reload")
  );
});
