{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-25.11";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };

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

        # Environment variables needed for both running and developing
        shellVars = ''
          export WEBKIT_DISABLE_DMABUF_RENDERER=1
          export GIO_MODULE_DIR="${pkgs.glib-networking}/lib/gio/modules/"
          export XDG_DATA_DIRS="${pkgs.gsettings-desktop-schemas}/share/gsettings-schemas/${pkgs.gsettings-desktop-schemas.name}:${pkgs.gtk3}/share/gsettings-schemas/${pkgs.gtk3.name}:''${XDG_DATA_DIRS:-}"
          export LD_LIBRARY_PATH="${pkgs.lib.makeLibraryPath runtimeLibs}:''${LD_LIBRARY_PATH:-}"
        '';
      in
      {
        # 1. This is for 'nix run' (pointing to your pre-built app)
        packages.default = pkgs.writeShellApplication {
          name = "puffin";
          runtimeInputs = runtimeLibs;
          text = ''
            ${shellVars}
            exec /home/luiz/apps/puffin/src-tauri/target/release/puffin "$@"
          '';
        };

        # 2. This is for 'nix develop' (restoring your tools)
        devShells.default = pkgs.mkShell {
          nativeBuildInputs = with pkgs; [
            rustc
            cargo
            cargo-tauri
            pkg-config
            gobject-introspection
            nodejs
            bun
          ];
          
          buildInputs = runtimeLibs;
          
          shellHook = shellVars;
        };
      }
    );
}