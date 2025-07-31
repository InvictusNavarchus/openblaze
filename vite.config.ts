import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';

/**
 * Custom plugin to build content scripts as self-contained bundles
 * @param outDir - The output directory for the build
 * @returns Vite plugin object
 */
function contentScriptPlugin(outDir: string) {
  return {
    name: 'content-script-bundler',
    async writeBundle() {
      try {
        // Ensure the output directory exists
        const outputDir = resolve(__dirname, `${outDir}/js`);
        if (!existsSync(outputDir)) {
          mkdirSync(outputDir, { recursive: true });
          console.log(`Created output directory: ${outputDir}`);
        }

        // Import rollup dynamically to build content scripts separately
        const { rollup } = await import('rollup');

        const contentScripts = [
          { name: 'contentScript', input: resolve(__dirname, 'src/content/contentScript.ts') },
          { name: 'inPageNotifier', input: resolve(__dirname, 'src/content/inPageNotifier.ts') }
        ];

        for (const script of contentScripts) {
          try {
            console.log(`Building content script: ${script.name}`);

            const bundle = await rollup({
              input: script.input,
              external: [], // Don't externalize anything
              plugins: [
                // Add TypeScript support
                (await import('@rollup/plugin-typescript')).default({
                  tsconfig: resolve(__dirname, 'tsconfig.json'),
                  declaration: false,
                  declarationMap: false,
                  outDir: undefined, // Let rollup handle the output
                  compilerOptions: {
                    allowImportingTsExtensions: false,
                    outDir: undefined, // Override tsconfig outDir
                  },
                }),
                // Add node resolution
                (await import('@rollup/plugin-node-resolve')).default({
                  browser: true,
                  preferBuiltins: false,
                }),
              ],
            });

            await bundle.write({
              file: `${outDir}/js/${script.name}.js`,
              format: 'iife',
              inlineDynamicImports: true,
            });

            await bundle.close();
            console.log(`Successfully built: ${script.name}.js`);
          } catch (scriptError) {
            console.error(`Failed to build content script '${script.name}':`, scriptError);
            throw scriptError; // Re-throw to fail the build process
          }
        }
      } catch (error) {
        console.error('Content script bundling failed:', error);
        throw error; // Re-throw to fail the build process
      }
    }
  };
}

/**
 * Custom plugin to copy extension assets based on target browser
 * @param target - The target browser ('chrome' or 'firefox')
 * @param outDir - The output directory for the build
 * @returns Vite plugin object
 */
function copyExtensionAssetsPlugin(target: 'chrome' | 'firefox', outDir: string) {
  return {
    name: 'copy-extension-assets',
    writeBundle() {
      // Copy the appropriate manifest file
      const manifestFile = target === 'firefox' ? 'src/manifest-firefox.json' : 'src/manifest-chrome.json';
      copyFileSync(manifestFile, `${outDir}/manifest.json`);

      // Copy HTML files
      const htmlFiles = ['popup.html', 'options.html', 'sandbox.html', 'offscreen.html'];
      htmlFiles.forEach(file => {
        const srcPath = `src/${file.replace('.html', '')}/${file}`;
        if (existsSync(srcPath)) {
          copyFileSync(srcPath, `${outDir}/${file}`);
        }
      });

      // Copy CSS files
      const copyDir = (src: string, dest: string) => {
        if (!existsSync(dest)) {
          mkdirSync(dest, { recursive: true });
        }
        const files = readdirSync(src);
        files.forEach((file: string) => {
          const srcPath = resolve(src, file);
          const destPath = resolve(dest, file);
          if (statSync(srcPath).isDirectory()) {
            copyDir(srcPath, destPath);
          } else {
            copyFileSync(srcPath, destPath);
          }
        });
      };

      // Copy assets if they exist
      if (existsSync('src/assets')) {
        copyDir('src/assets', `${outDir}/images`);
      }

      // Find and copy CSS files
      const findAndCopyCss = (dir: string) => {
        const files = readdirSync(dir);
        files.forEach(file => {
          const fullPath = resolve(dir, file);
          if (statSync(fullPath).isDirectory()) {
            findAndCopyCss(fullPath);
          } else if (file.endsWith('.css')) {
            const destDir = `${outDir}/css`;
            if (!existsSync(destDir)) {
              mkdirSync(destDir, { recursive: true });
            }
            copyFileSync(fullPath, resolve(destDir, file));
          }
        });
      };

      if (existsSync('src')) {
        findAndCopyCss('src');
      }
    }
  };
}

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';
  const target = (process.env.TARGET as 'chrome' | 'firefox') || 'chrome';
  const outDir = target === 'firefox' ? 'dist-firefox' : 'dist-chrome';

  return {
    plugins: [
      // Custom plugin to copy manifest and assets for specific browser
      copyExtensionAssetsPlugin(target, outDir),
      // Add the content script plugin
      contentScriptPlugin(outDir)
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    build: {
      target: 'baseline-widely-available', // Vite 7 default
      outDir,
      emptyOutDir: true,
      sourcemap: !isProduction ? 'inline' : false,
      minify: isProduction,
      rollupOptions: {
        input: {
          background: resolve(__dirname, 'src/background/background.ts'),
          // Remove content scripts from main build - they'll be built separately
          // contentScript: resolve(__dirname, 'src/content/contentScript.ts'),
          // inPageNotifier: resolve(__dirname, 'src/content/inPageNotifier.ts'),
          popup: resolve(__dirname, 'src/popup/popup.ts'),
          options: resolve(__dirname, 'src/options/options.ts'),
          sandbox: resolve(__dirname, 'src/sandbox/sandbox.ts'),
          offscreen: resolve(__dirname, 'src/offscreen/offscreen.ts'),
        },
        output: {
          entryFileNames: 'js/[name].js',
          chunkFileNames: 'js/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
            const name = assetInfo.names?.[0] || '';
            if (/\.(png|jpe?g|svg|gif|tiff|bmp|ico)$/i.test(name)) {
              return `images/[name][extname]`;
            }
            if (/\.css$/i.test(name)) {
              return `css/[name][extname]`;
            }
            return `assets/[name]-[hash][extname]`;
          },
          // Allow normal chunking for non-content-script files
          // Content scripts are built separately by our custom plugin
        },
      },
    },
    define: {
      __DEV__: !isProduction,
    },
  };
});
