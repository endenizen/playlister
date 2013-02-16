(function() {
  var Echonest = {
    call: function(apiType, method, params, callback) {
      var apiKey = "ZPEIDZVOB6RGVF3ZP",
          echonestUrl = "http://developer.echonest.com/api/v4/",
          url = [
            echonestUrl,
            apiType + '/' + method,
            '?api_key=' + apiKey,
            '&format=jsonp',
            '&bucket=id:rdio-us-streaming',
          ].join('');

      $.each(params, function(key, val) {
        val = ""+val;
        $.each(val.split(','), function() {
          url += '&' + key + '=' + this;
        });
      });
      
      console.log(url);

      $.ajax({
        url: url,
        dataType: 'jsonp',
        success: function(results)
          {callback(results.response.songs);
        },
        cache: true
      });
    },
    songIds: function(rdioTrackKeys) {
      // FIXME(Jon): Ugly as shit and should take a country code
      var echonestIds = [];
      _.each(rdioTrackKeys, function(list){
        echonestIds.push("rdio-US:track:" + list);
      });
      return echonestIds
    },

    songRadio: function(trackKeys, k) {
      var enkeys = this.songIds(trackKeys);
      var params = {
        track_id: enkeys, 
        type: 'song-radio', 
        limit: true, 
        results: 30};
      this.call('playlist', 'static', params, function(results) {
        var res = [];
        if (results.length){
          // Take each result and get eh foreign id.
          // Sample JSON and explains the shitshow below.
          // "songs": [
          //   {
          //     "foreign_ids": [
          //       {
          //         "catalog": "rdio-us-streaming",
          //         "foreign_id": "rdio-us-streaming:song:t6520763"
          //       }
          //     ],
          //     "artist_id": "ARJCGQP1187FB525E0",
          //     "id": "SODDXKX12AB017E3B0",
          //     "artist_name": "Serotone",
          //     "title": "Shattered"
          //   },
          _.each(results, function(result) {
            res.push(result.foreign_ids[0].foreign_id.split(':')[2]);
          });
        } else { // No results, move on.
          res = [];
          console.log("No Results!");
        }
        k(res);
      })

    }
  };

  var Playlister = function() {
    this.init();
  };

  _.extend(Playlister.prototype, {
    init: function() {
      var self = this;
      R.ready(function() {
        self.extend(['t7116064'], function(tracks) {
          console.info('got tracks: ', tracks);
        });
      });
    },

    extend: function(tracks, k) {

      // tracks is a list of rdio track keys
      // generate static playlist through echonest
      // call k(rdioTrackKeys)
      Echonest.songRadio(tracks, k)
    }
  });

  $(document).ready(function() {
    window.app = new Playlister();
  });
})();
