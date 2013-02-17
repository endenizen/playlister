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
          '&bucket=id:rdio-us-streaming'
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
        success: function(results) {
          callback(results.response.songs);
        },
        cache: true
      });
    },

    songIds: function(rdioTrackKeys) {
      // FIXME(Jon): Ugly as shit and should take a country code
      var echonestIds = [];
      _.each(rdioTrackKeys, function(list) {
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
        results: 30
      };

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
      });
    }
  };

  var Playlister = function() {
    this.init();
  };

  _.extend(Playlister.prototype, {
    MAX_TRACKS: 5,

    // Find results for search and display them (also add them to trackLookup)
    onSearchClicked: function() {
      var self = this;

      var query = $('#searchrow').find('input').val();

      // call api
      R.request({
        method: 'search',
        content: {
          types: 'Track',
          query: query
        },
        success: function(result) {
          var tracks = result.result.results;
          _.each(tracks, function(track) {
            self.trackLookup[track.key] = track;
          });
          var tmp = _.template($('#tracklist-template').text());
          $('#searchresults')
            .find('.searchlist').html(tmp({ tracks: tracks })).end()
            .show();
        }
      });
    },

    // Add selected result to seed track list (using trackLookup)
    onSearchResultSelected: function(e) {
      var track = this.trackLookup[$(e.target).data('key')];
      var tmp = _.template($('#seedtrack-template').text());
      $('#searchresults').hide();
      $('#seedtracks').append(tmp({ track: track })).show();
      $('#searchrow').find('input').val('').focus();
      $('#go').show();
    },

    // Trigger the extending of the playlist
    onGoClicked: function() {
      var self = this;
      var tracks = $('#seedtracks').find('.seedtrack');
      var trackKeys = [];
      _.each(tracks, function(track) {
        trackKeys.push($(track).data('key'));
      });
      $('#save').hide();
      $('#tracks').hide();
      this.extend(trackKeys, function(tracks) {
        R.request({
          method: 'get',
          content: {
            keys: tracks
          },
          success: function(response) {
            var trackObjs = [];
            _.each(tracks, function(trackKey) {
              var newObj = response.result[trackKey];
              if (newObj) {
                trackObjs.push(newObj);
              }
            });
            self.renderTracks(trackObjs);
            $('#save').show();
          }
        });
      });
    },

    onSearchKeyDown: function(e) {
      if (e.keyCode === 13) {
        this.onSearchClicked();
      }
    },

    onSaveClicked: function(e) {
      $('#save').find('.savepanel').show();
    },

    savePlaylist: function(name, tracks) {
      var self = this;
      R.request({
        method: 'createPlaylist',
        content: {
          name: name,
          description: 'Created with Playlister',
          tracks: tracks
        },
        success: function(result) {
          self.hideSavePanel();
          self.launchPartyMode(result.result.key);
        }
      });
    },

    launchPartyMode: function(playlistKey) {
      R.player.play({ source: playlistKey });
    },

    onSaveConfirmClicked: function(e) {
      var self = this;
      var name = $('#save').find('input').val();
      if (!name) {
        return;
      }
      var tracks = [];
      _.each($('#seedtracks, #tracks ul').children(), function(trackEl) {
        tracks.push($(trackEl).data('key'));
      });
      if (R.authenticated) {
        this.savePlaylist(name, tracks);
      } else {
        R.authenticate(function() {
          self.savePlaylist(name, tracks);
        });
      }
    },

    onSaveCancelClicked: function() {
      this.hideSavePanel();
    },

    hideSavePanel: function() {
      $('#save').find('.savepanel').hide();
      $('#save').find('input').val('');
    },

    onHideSearchResultsClicked: function() {
      $('#searchresults').hide();
    },

    onRemoveTrackClicked: function(e) {
      var curSeeds = $('#seedtracks').find('.seedtrack');
      if (curSeeds.length === 1) {
        $('#go').hide();
        $('#seedtracks').hide();
      }
      var el = $(e.target);
      el.closest('.seedtrack').remove();
    },

    init: function() {
      var self = this;

      this.trackLookup = {};

      $.fx.speeds._default = 200;

      _.bindAll(this, 'onSearchClicked', 'onSearchKeyDown', 'onSearchResultSelected', 'onGoClicked',
        'onSaveClicked', 'onSaveConfirmClicked', 'onSaveCancelClicked', 'onHideSearchResultsClicked',
        'onRemoveTrackClicked');

      $('#seedtracks')
        .on('click', '.removetrack', this.onRemoveTrackClicked);

      $('#searchrow').find('input').focus().end()
        .on('keydown', 'input', this.onSearchKeyDown)
        .on('click', '.searchbutton', this.onSearchClicked);

      $('#searchresults')
        .on('click', 'li', this.onSearchResultSelected)
        .on('click', '.hidesearch', this.onHideSearchResultsClicked);

      $('#go').on('click', 'span', this.onGoClicked);

      $('#save')
        .on('click', 'span.launchsave', this.onSaveClicked)
        .on('click', 'span.confirmsave', this.onSaveConfirmClicked)
        .on('click', 'span.cancelsave', this.onSaveCancelClicked);
    },

    extend: function(tracks, k) {
      Echonest.songRadio(tracks, k)
    },

    /**
     * Render a list of tracks
     */
    renderTracks: function(tracks) {
      var tmp = _.template($('#tracklist-template').text());
      $('#tracks').html(tmp({'tracks':tracks})).show();
    }
  });

  $(document).ready(function() {
    window.app = new Playlister();
  });
})();
