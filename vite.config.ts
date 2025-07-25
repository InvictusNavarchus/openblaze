import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';

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
      }
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
      sourcemap: !isProduction,
      minify: isProduction,
      rollupOptions: {
        input: {
          background: resolve(__dirname, 'src/background/background.ts'),
          'types-global': resolve(__dirname, 'src/content/types-global.js'),
          'utils-global': resolve(__dirname, 'src/content/utils-global.js'),
          'form-handler-global': resolve(__dirname, 'src/content/form-handler-global.js'),
          'keyboard-shortcuts-global': resolve(__dirname, 'src/content/keyboard-shortcuts-global.js'),
          contentScript: resolve(__dirname, 'src/content/contentScript.ts'),
          inPageNotifier: resolve(__dirname, 'src/content/inPageNotifier.ts'),
          popup: resolve(__dirname, 'src/popup/popup.ts'),
          options: resolve(__dirname, 'src/options/options.ts'),
          sandbox: resolve(__dirname, 'src/sandbox/sandbox.ts'),
          offscreen: resolve(__dirname, 'src/offscreen/offscreen.ts'),
        },
        output: {
          entryFileNames: 'js/[name].js',
          chunkFileNames: 'js/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
            const fileName = assetInfo.names?.[0] || '';
            if (/\.(png|jpe?g|svg|gif|tiff|bmp|ico)$/i.test(fileName)) {
              return `images/[name][extname]`;
            }
            if (/\.css$/i.test(fileName)) {
              return `css/[name][extname]`;
            }
            return `assets/[name]-[hash][extname]`;
          },
        },
      },
    },
    define: {
      __DEV__: !isProduction,
    },
  };
});
