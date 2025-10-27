module.exports = {
  hooks: {
    readPackage(pkg) {
      // Ensure proper peer dependency resolution
      if (pkg.peerDependencies) {
        pkg.peerDependenciesMeta = pkg.peerDependenciesMeta || {};
        Object.keys(pkg.peerDependencies).forEach(dep => {
          if (!pkg.peerDependenciesMeta[dep]) {
            pkg.peerDependenciesMeta[dep] = { optional: true };
          }
        });
      }
      return pkg;
    }
  }
};
