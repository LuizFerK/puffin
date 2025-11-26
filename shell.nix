let
  pkgs = import <nixpkgs> { };
in
pkgs.mkShell {
  nativeBuildInputs = with pkgs; [
    rustc
    pkg-config
    gobject-introspection
    cargo 
    cargo-tauri # Optional, Only needed if Tauri doesn't work through the traditional way.
    nodejs # Optional, this is for if you have a js frontend
  ];

  buildInputs = with pkgs;[
    at-spi2-atk
    atkmm
    cairo
    gdk-pixbuf
    glib
    gtk3
    harfbuzz
    librsvg
    libsoup_3
    pango
    webkitgtk_4_1
    openssl
    bun
  ];
  shellHook = with pkgs; ''
    export XDG_DATA_DIRS=${gsettings-desktop-schemas}/share/gsettings-schemas/${gsettings-desktop-schemas.name}:${gtk3}/share/gsettings-schemas/${gtk3.name}:$XDG_DATA_DIRS;
    export GIO_MODULE_DIR="${pkgs.glib-networking}/lib/gio/modules/";
  '';
}

