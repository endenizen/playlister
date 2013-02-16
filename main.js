(function() {
  var Playlister = function() {
    this.init();
  };

  _.extend(Playlister.prototype, {
    init: function() {
      var self = this;
      R.ready(function() {
        self.extend(['t7116064'], function(tracks) {
          console.info('got tracks: ', tracks);
        };
      });
    },

    extend: function(tracks, k) {
      // tracks is a list of rdio track keys
      // generate static playlist through echonest
      // call k(rdioTrackKeys)
    }
  });

  $(document).ready(function() {
    window.app = new Playlister();
  });
})();
