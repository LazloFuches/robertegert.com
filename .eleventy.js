const Image = require("@11ty/eleventy-img");
const path = require("path");

module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/assets/css");
  eleventyConfig.addPassthroughCopy("src/assets/pdfs");
  eleventyConfig.addPassthroughCopy("src/assets/images");
  eleventyConfig.addPassthroughCopy("src/assets/glightbox.min.js");
  eleventyConfig.addPassthroughCopy("src/assets/js");
  eleventyConfig.addPassthroughCopy("src/robots.txt");
  eleventyConfig.addPassthroughCopy("src/_redirects");
  eleventyConfig.addPassthroughCopy("src/_headers");
  eleventyConfig.addPassthroughCopy("src/llms.txt");
  eleventyConfig.addPassthroughCopy("src/admin");

  const imageProfiles = {
    thumbnail: {
      widths: [400, 600, 800],
      jpegQuality: 82,
      webpQuality: 82,
    },
    grid: {
      widths: [400, 600, 800],
      jpegQuality: 85,
      webpQuality: 85,
    },
    detail: {
      widths: [1200, 1800, 2400],
      jpegQuality: 90,
      webpQuality: 90,
    },
  };

  eleventyConfig.addNunjucksAsyncShortcode("image", async function(src, alt, type, cssClass, eager) {
    const profile = imageProfiles[type] || imageProfiles.grid;
    const inputPath = path.join("src", src);

    const metadata = await Image(inputPath, {
      widths: profile.widths,
      formats: ["webp", "jpeg"],
      outputDir: "./_site/img/",
      urlPath: "/img/",
      filenameFormat: function(id, src, width, format) {
        const dir = path.basename(path.dirname(src));
        const name = path.basename(src, path.extname(src));
        return `${dir}-${name}-${width}w.${format}`;
      },
      sharpJpegOptions: { quality: profile.jpegQuality, progressive: true },
      sharpWebpOptions: { quality: profile.webpQuality },
    });

    const imageAttributes = {
      alt: alt || "",
      loading: eager ? "eager" : "lazy",
      decoding: eager ? "sync" : "async",
    };
    if (eager) {
      imageAttributes.fetchpriority = "high";
      imageAttributes.sizes = "100vw";
    }
    if (cssClass) imageAttributes.class = cssClass;

    return Image.generateHTML(metadata, imageAttributes);
  });

  function slugify(str) {
    return str.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  eleventyConfig.addCollection("currentWorkArtworks", function(collectionApi) {
    const projectsData = require("./src/_data/projects.json");
    const currentSlugs = projectsData
      .filter(p => p.section === "current")
      .map(p => p.slug);

    const artworks = [];
    const projectPages = collectionApi.getFilteredByGlob("src/projects/*.njk")
      .filter(p => currentSlugs.includes(p.fileSlug) && p.data.images && p.data.images.length > 0);

    for (const project of projectPages) {
      project.data.images.forEach((img, i) => {
        artworks.push({
          ...img,
          slug: slugify(img.title),
          projectTitle: project.data.title,
          projectYear: project.data.year,
          projectSlug: project.fileSlug,
          index: i,
          total: project.data.images.length,
        });
      });
    }

    const seenSlugs = {};
    artworks.forEach(a => {
      if (seenSlugs[a.slug]) {
        seenSlugs[a.slug]++;
        a.slug = a.slug + '-' + seenSlugs[a.slug];
      } else {
        seenSlugs[a.slug] = 1;
      }
    });

    return artworks;
  });

  eleventyConfig.addCollection("artworks", function(collectionApi) {
    const artworks = [];
    const projectPages = collectionApi.getFilteredByGlob("src/projects/*.njk")
      .filter(p => p.data.images && p.data.images.length > 0);

    for (const project of projectPages) {
      project.data.images.forEach((img, i) => {
        artworks.push({
          ...img,
          projectTitle: project.data.title,
          projectYear: project.data.year,
          projectSlug: project.fileSlug,
          index: i,
          total: project.data.images.length,
        });
      });
    }
    return artworks;
  });

  return {
    dir: {
      input: "src",
      output: "_site"
    }
  };
};