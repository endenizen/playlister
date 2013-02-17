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
          callback(results.response);
        },
        cache: true
      });
    },

    songIds: function(rdioTrackKeys, k) {
      // FIXME(Jon): Ugly as shit and should take a country code
      var done = _.after(rdioTrackKeys.length, function() {
        k(echonestIds)
      });
      var echonestIds = [];
      _.each(rdioTrackKeys, function(list) {
        Echonest.call('song', 'profile', {
          track_id: "rdio-US:track:" + list
        }, 
        function(results) {
          if (results.status.code === 0 && results.songs.length) { // 0 means success!
            echonestIds.push(results.songs[0].id)
          } else {
            console.log("ID: " + list + " missing in echonest :'(")
          }
          done();
        });
      });
    },

    songRadio: function(trackKeys, k) {
      Echonest.songIds(trackKeys, function(enkeys) {

        var params = {
          song_id: enkeys, 
          type: 'song-radio', 
          limit: true, 
          results: 30
        };

        Echonest.call('playlist', 'static', params, function(results) {
          var res = [];
          if (results.songs.length) {
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
            _.each(results.songs, function(result) {
              res.push(result.foreign_ids[0].foreign_id.split(':')[2]);
            });
          } else { // No results, move on.
            res = [];
            console.log("No Results!");
          }
          k(res);
        });
      });
    },
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
          self.displaySearchResults(tracks);
        }
      });
    },

    displaySearchResults: function(tracks) {
      var tmp = _.template($('#tracklist-template').text());
      $('#searchresults')
        .find('.searchlist').html(tmp({ tracks: tracks })).end()
        .show();
    },

    // Add selected result to seed track list (using trackLookup)
    onSearchResultSelected: function(e) {
      var track = this.trackLookup[$(e.target).data('key')];
      var tmp = _.template($('#seedtrack-template').text());
      $('#searchresults').hide();
      $('#seedtracks').append(tmp({ track: track })).show();
      $('#searchrow').find('input').val('').focus();
      $('#go').show();
      this.playTrack(track);
    },

    playTrack: function(track) {
      R.player.play({ source: track.key });
    },

    // Trigger the extending of the playlist
    onGoClicked: function() {
      var self = this;
      var tracks = $('#seedtracks').find('.seedtrack');
      var trackKeys = [];
      _.each(tracks, function(track) {
        trackKeys.push($(track).data('key'));
      });
      R.player.pause();
      $('#save').hide();
      $('#tracks').hide();
      $('#searchrow').hide();
      $('#seedtracks').find('.removetrack').hide();
      $('#go').hide();
      var wiz = $('.wizard');
      wiz.addClass('loading');
      this.extend(trackKeys, function(tracks) {
        R.request({
          method: 'get',
          content: {
            keys: tracks
          },
          success: function(response) {
            wiz.removeClass('loading');
            var trackObjs = [];
            _.each(tracks, function(trackKey) {
              var newObj = response.result[trackKey];
              if (newObj) {
                trackObjs.push(newObj);
              }
            });
            self.renderTracks(trackObjs);
            $('.left').removeClass('initial');
            $('#save').show();
          }
        });
      });
    },

    onSearchKeyDown: function(e) {
      if (e.keyCode === 13) {
        this.onSearchClicked();
      }
      if ($('#searchresults').is(':visible')) {
        this.onHideSearchResultsClicked();
      }
    },

    onSaveClicked: function(e) {
      $('#save').find('.savepanel').fadeIn();
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
      $('.search').fadeOut();
      $('#partymode').fadeIn();
      $('body').addClass('partymode');

      R.player.on("change:playingTrack", function(song) {
        $('#artwork').attr('src', song.get('icon').replace('200', '1200'));
      });
    },

    // Player controls
    playOrPause: function() {
      R.player.togglePause();
    },

    playerNext: function() {
      R.player.next();
    },

    playerPrevious: function() {
      R.player.previous();
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
      this.savePlaylist(name, tracks);
    },

    onSaveCancelClicked: function() {
      this.hideSavePanel();
    },

    hideSavePanel: function() {
      $('#save').find('.savepanel').fadeOut();
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

    onAuthClicked: function() {
      var self = this;
      R.authenticate(function() {
        self.loggedIn();
      })
    },

    loggedIn: function() {
      $('#auth').hide();
      $('#content').show();
    },

    onWizardClicked: function() {
      if ($('#tracks').find('li').length > 0) {
        this.onGoClicked();
      }
    },

    init: function() {
      var self = this;

      this.trackLookup = {};

      $.fx.speeds._default = 200;

      _.bindAll(this, 'onSearchClicked', 'onSearchKeyDown', 'onSearchResultSelected', 'onGoClicked',
        'onSaveClicked', 'onSaveConfirmClicked', 'onSaveCancelClicked', 'onHideSearchResultsClicked',
        'onRemoveTrackClicked', 'onAuthClicked', 'playOrPause', 'playerPrevious', 'playerNext', 'onWizardClicked');

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

      $('#auth')
        .on('click', '.wizard', this.onAuthClicked);

      $('.right')
        .on('click', '.wizard', this.onWizardClicked);

      $('#partymode')
        .on('click', '.play', this.playOrPause)
        .on('click', '.next', this.playerNext)
        .on('click', '.previous', this.playerPrevious);

      R.ready(function() {
        if (R.authenticated()) {
          self.loggedIn();
        }
      });
    },

    extend: function(tracks, k) {
      Echonest.songRadio(tracks, k)
    },

    /**
     * Render a list of tracks
     */
    renderTracks: function(tracks) {
      var tmp = _.template($('#tracklist-template').text());
      $('#tracks').html(tmp({'tracks':tracks})).fadeIn();
    }
  });

  $(document).ready(function() {
    window.app = new Playlister();
  });
})();
