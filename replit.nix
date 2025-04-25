{pkgs}: {
  deps = [
    pkgs.duckdb
    pkgs.awscli
    pkgs.cacert
    pkgs.dnsutils
    pkgs.dig
    pkgs.zip
    pkgs.jq
    pkgs.unzip
    pkgs.postgresql
    pkgs.glibcLocales
    pkgs.libyaml
  ];
}
