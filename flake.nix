{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-26.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
        inherit (pkgs) lib;

        pnpm = pkgs.pnpm_11;

        # pg_dump refuses servers newer than itself, so ship the newest client
        postgresql = pkgs.postgresql_18;

        # Shared runtime dependencies
        runtimeLibs = with pkgs; [
          gtk3
          webkitgtk_4_1
          librsvg
          libsoup_3
          glib-networking
          gsettings-desktop-schemas
          openssl
        ];

        # Only what the build reads, so docs or test edits don't trigger a rebuild
        src = lib.fileset.toSource {
          root = ./.;
          fileset = lib.fileset.unions [
            ./index.html
            ./package.json
            ./pnpm-lock.yaml
            ./pnpm-workspace.yaml
            ./tsconfig.json
            ./tsconfig.node.json
            ./uno.config.ts
            ./vite.config.ts
            ./public
            ./src
            (lib.fileset.difference ./src-tauri (lib.fileset.maybeMissing ./src-tauri/target))
          ];
        };

        puffin = pkgs.rustPlatform.buildRustPackage (finalAttrs: {
          pname = "puffin";
          version = (lib.importTOML ./src-tauri/Cargo.toml).package.version;
          inherit src;

          # Bump with the hash Nix reports whenever pnpm-lock.yaml changes
          pnpmDeps = pkgs.fetchPnpmDeps {
            inherit (finalAttrs) pname version src;
            inherit pnpm;
            fetcherVersion = 4;
            hash = "sha256-9pKGCjCCmIzjnlfmfKAyyWsLR60I33WOdZLy7n6zWdI=";
          };

          cargoRoot = "src-tauri";
          buildAndTestSubdir = finalAttrs.cargoRoot;
          cargoLock.lockFile = ./src-tauri/Cargo.lock;

          nativeBuildInputs = with pkgs; [
            nodejs
            pnpm
            pnpmConfigHook
            cargo-tauri.hook
            pkg-config
            wrapGAppsHook3
          ];

          buildInputs = runtimeLibs;

          preFixup = ''
            gappsWrapperArgs+=(--set WEBKIT_DISABLE_DMABUF_RENDERER 1)
            gappsWrapperArgs+=(--prefix PATH : ${lib.makeBinPath [ postgresql ]})
          '';

          meta = {
            description = "PostgreSQL GUI";
            homepage = "https://github.com/LuizFerK/puffin";
            license = lib.licenses.mit;
            mainProgram = "puffin";
            platforms = lib.platforms.linux;
          };
        });
      in
      {
        packages.default = puffin;

        devShells.default = pkgs.mkShell {
          nativeBuildInputs = with pkgs; [
            rustc
            cargo
            cargo-tauri
            pkg-config
            gobject-introspection
            nodejs
            pnpm
            postgresql
          ];

          buildInputs = runtimeLibs;

          shellHook = ''
            export WEBKIT_DISABLE_DMABUF_RENDERER=1
            export GIO_MODULE_DIR="${pkgs.glib-networking}/lib/gio/modules/"
            export XDG_DATA_DIRS="${pkgs.gsettings-desktop-schemas}/share/gsettings-schemas/${pkgs.gsettings-desktop-schemas.name}:${pkgs.gtk3}/share/gsettings-schemas/${pkgs.gtk3.name}:''${XDG_DATA_DIRS:-}"
            export LD_LIBRARY_PATH="${lib.makeLibraryPath runtimeLibs}:''${LD_LIBRARY_PATH:-}"
          '';
        };
      }
    );
}
