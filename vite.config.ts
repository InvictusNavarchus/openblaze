import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';

// Custom plugin to build content scripts as self-contained bundles
function contentScriptPlugin() {
  return {
    name: 'content-script-bundler',
    async writeBundle() {
      try {
        // Ensure the output directory exists
        const outputDir = resolve(__dirname, 'dist/js');
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
                  compilerOptions: {
                    allowImportingTsExtensions: false,
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
              file: `dist/js/${script.name}.js`,
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

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';

  return {
    plugins: [
      // Custom plugin to copy manifest and assets
      {
        name: 'copy-extension-assets',
        writeBundle() {
          // Copy manifest
          copyFileSync('src/manifest.json', 'dist/manifest.json');

          // Copy HTML files
          const htmlFiles = ['popup.html', 'options.html', 'sandbox.html', 'offscreen.html'];
          htmlFiles.forEach(file => {
            const srcPath = `src/${file.replace('.html', '')}/${file}`;
            if (existsSync(srcPath)) {
              copyFileSync(srcPath, `dist/${file}`);
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
            copyDir('src/assets', 'dist/images');
          }

          // Find and copy CSS files
          const findAndCopyCss = (dir: string) => {
            const files = readdirSync(dir);
            files.forEach(file => {
              const fullPath = resolve(dir, file);
              if (statSync(fullPath).isDirectory()) {
                findAndCopyCss(fullPath);
              } else if (file.endsWith('.css')) {
                const destDir = 'dist/css';
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
      },
      // Add the content script plugin
      contentScriptPlugin()
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    build: {
      target: 'baseline-widely-available', // Vite 7 default
      outDir: 'dist',
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
          // Force content scripts to be self-contained by preventing chunk creation
          manualChunks: (id) => {
            // Check if this module is imported by content scripts
            if (id.includes('src/utils/') || id.includes('src/types/')) {
              // Don't create chunks for utility modules - inline them
              return undefined;
            }
            // Allow other modules to be chunked normally
            return undefined;
          },
          // Set a very high minimum chunk size to force inlining
          experimentalMinChunkSize: 100000,
        },
      },
    },
    define: {
      __DEV__: !isProduction,
    },
  };
});
