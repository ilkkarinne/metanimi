"use strict";

//"Package" definitions
var com = com || {};
com.metanimi = com.metanimi || {};

// Module VideoAnimator:
com.metanimi.VideoAnimator = (function() {
	var _width = 1280;
	var _height = 720;

	var _buf1;
	var _buf2;
	var _disp;
	var _dispCtx;
	var _glassPane;
	var _pauseIcon;
	var _playIcon;
	var _loadingIcon;
	var _clock;
	var _dayIndicator;
	var _thumbnail;
	var _visibleBuf;
	var _currentTime;
	var _timeFactor;
	var _loading=false;
	var _paused=false;
	var _seeking=false;
	var _rewinding=false;
	var _wasPlayingBeforeSeek=false;
	var _clipIndex = 0;
	var _clips = [];
	var _thumbWidth = 150;
	var _thumbHeight = 84;

	var _scrollSpeed=0;
	var _baseUrl = './';
    var _indexBaseUrl = './';
	var _looping = false;
	var _clockPaper;
	var _clockHourHand;
	var _clockMinHand;
	var _clockLoadedPie;
	var _clockFace;
	var _clockRim;
	var _timeLabel;
	var _daySelector;
    var _playButton;
    var _repeatButton;
    var _stepForwardButton;
    var _stepBackwardButton;
    var _fastForwardButton;
    var _fastBackwardButton;
    var _forwardButton;
    var _backwardButton;
    var _infoButton;
    var _errorDialog;
    var _aboutDialog;
    var _infoDialog;
	var _monthThumbsUrlResolver;
	var _momentumDamperTimer;
    var _myLastHashTime;
    var _otherBufContainsNextInTime = false;
    var _otherBufContainsPrevInTime = false;
	var radArchConst;
	
	var debouncedSeekStart = _.debounce(function(){
		if (!_seeking){
			_seeking = true;
			_wasPlayingBeforeSeek = !_paused;
			if (_wasPlayingBeforeSeek) freeze(true);
		}
	},150, true);
	
	var debouncedClamper = _.debounce(clampScrollingDown,100);
    var throttledHashUpdater = _.throttle(function(){
	if (_currentTime && _currentTime.isValid()){
	    var utcTime = moment(_currentTime).utc();
	    _myLastHashTime = utcTime.format('YYYY-MM-DDTHH:mm:ss')+'Z';
	    location.replace('#'+_myLastHashTime);
	}
    },500);
	function init(containers){
		_disp = $('<canvas></canvas>').attr('style','position:absolute;top:0;left:0;max-width:'+_width+'px;max-height:'+_height+'px;height:100%');
		_clock = $('<div></div>').addClass('clock').attr('style','z-index:100');

		_glassPane = $('<div></div>').attr('style','position:absolute;top:0;left:0;max-width:'+_width+'px;max-height:'+_height+'px;z-index:20');

		_pauseIcon = $('<div></div>').attr('style','position:relative;top:0;left:0;width:90px;height:150px;border-left:35px solid black;border-right:35px solid black;opacity:0');
		_glassPane.append(_pauseIcon);
		_pauseIcon.hide();
		
		_playIcon = $('<div></div>').attr('style','position:relative;top:0;left:0;width:0;height:0;border-top:80px solid transparent;border-bottom:80px solid transparent;border-left:85px solid black;opacity:0');
		_glassPane.append(_playIcon);
		_playIcon.hide();
		
		_loadingIcon = $('<div></div>').attr('style','position:relative;top:50%;left:50%;width:70pt;height:70pt;margin-left:-35pt;margin-top:-35ptem;opacity:0;text-align:center');
	    _loadingIcon.append($('<i></i>').addClass('fa fa-spinner fa-spin').attr('style','font-size:60pt;color:#000000;'));
		_glassPane.append(_loadingIcon);
		_loadingIcon.hide();
		
	    _infoDialog = $('<div></div>').attr('style','position:relative;top:50%;left:50%;width:30em;height:10em;margin-left:-15em;margin-top:-5em;text-align:text-align;z-index:100;background-color:white;border-style:solid;border-width:1px;border-color:#888888;border-radius:10px;padding:1em;').attr('tabindex','-1');
		_glassPane.append(_infoDialog);
		_infoDialog.hide();

		_glassPane.append(_clock);

		_buf1 = $('<video></video>').attr({'style':'width:'+_width+'px;height:'+_height+'px;display:none;','id':'buf1'});
		_buf2 = $('<video></video>').attr({'style':'width:'+_width+'px;height:'+_height+'px;display:none;','id':'buf2'});

		_dispCtx = _disp.get(0).getContext('2d');
		
		_dayIndicator = $('<div></div>').css({'z-index':100,'font-family':'Helvetica, Arial, sans-serif','font-size':'13px','color':'#848484'}).addClass('dayindicator');
		_thumbnail = $('<div></div>').css({
			'width':_thumbWidth+'px',
			'height':_thumbHeight+'px',
			'background-position':'0px 0px',
			'background-repeat':'no-repeat',
			'margin-left':'auto',
			'margin-right':'auto',
			'margin-top':'5px',
			'margin-bottom':'5px'
		}).addClass('thumb');

		_timeLabel= $('<div></div>').addClass('timeLabel').attr('style','z-index:100;font-family:Helvetica, Arial, sans-serif;font-size:13px;color:#848484');
		_dayIndicator.append(_timeLabel);
		_dayIndicator.append(_thumbnail);
		
		_glassPane.append(_dayIndicator);
		
	    var buttons = $('<div></div>').addClass('button-row');

	    _stepBackwardButton = $('<div></div>').addClass('button step-backward').attr('title','Step back 5 min (left arrow)');
	    _stepBackwardButton.append($('<i></i>').addClass('fa fa-step-backward'));
	    buttons.append(_stepBackwardButton);

	    _playButton = $('<div></div>').addClass('button play').attr('title','Play / pause (space)');
	    _playButton.append($('<i></i>').addClass('fa fa-play'));
	    buttons.append(_playButton);

	    _repeatButton = $('<div></div>').addClass('button repeat').attr('title','Loop');
	    _repeatButton.append($('<i></i>').addClass('fa fa-repeat'));
	    buttons.append(_repeatButton);

	    _stepForwardButton = $('<div></div>').addClass('button step-forward').attr('title','Step fwd 5 min (right arrow)');
	    _stepForwardButton.append($('<i></i>').addClass('fa fa-step-forward'));
	    buttons.append(_stepForwardButton);

	    _fastBackwardButton = $('<div></div>').addClass('button fast-backward').attr('title','Jump back 1 day (page down)');
	    _fastBackwardButton.append($('<i></i>').addClass('fa fa-fast-backward'));
	    buttons.append(_fastBackwardButton);

	    _backwardButton = $('<div></div>').addClass('button backward').attr('title','Step back 1 hour (shift + right arrow)');
	    _backwardButton.append($('<i></i>').addClass('fa fa-backward'));
	    buttons.append(_backwardButton);

	    _forwardButton = $('<div></div>').addClass('button forward').attr('title','Step fwd 1 hour (shift + left arrow');
	    _forwardButton.append($('<i></i>').addClass('fa fa-forward'));
	    buttons.append(_forwardButton);

	    _fastForwardButton = $('<div></div>').addClass('button fast-forward').attr('title','Jump fwd 1 day (page up)');
	    _fastForwardButton.append($('<i></i>').addClass('fa fa-fast-forward'));
	    buttons.append(_fastForwardButton);


	    _glassPane.append(buttons);

	    if (_aboutDialog){
		_infoButton = $('<div></div>').addClass('button info').attr('title','About this app');
		_infoButton.append($('<i></i>').addClass('fa fa-info'));
		_glassPane.append(_infoButton);
	    }

		_disp.get(0).width = _width;
		_disp.get(0).height = _height;

		containers.append(_disp);
		containers.append(_glassPane);
	    containers.append(_buf1);
	    containers.append(_buf2);

		initClock(_clock);
		syncSizes();

		var keyDownBindings = {
			39: function(event){ //right arrow 
				if (event.shiftKey){
					jumpFwd(60*60*1000);
				}
				else {
					jumpFwd(5*60*1000);
				}
			},
			37: function(event){ //left arrow
				if (event.shiftKey){
					jumpBack(60*60*1000);
				}
				else {
					jumpBack(5*60*1000);
				}
			},
			34: function(event){ //pg down
				jumpToNext();
			},
			33: function(event){ //pg up
				jumpToPrev();
			},
			32: function(event){ //space
				pause(!_paused);
			}
		};
		
		var keyUpBindings = {
		};
			
		var videoEvents = {
			'playing': function(event){
				if (_scrollSpeed < 0){
					_scrollSpeed = (event.target.duration * 60 * 1000) / _clips[_clipIndex].duration;
				}
			    loadNextClipToBgBuf();
			},
			'seeking': function(event){
				debouncedSeekStart();
			},
			'seeked': function(event){
				_seeking = false;
				drawLoop();
				if (_wasPlayingBeforeSeek){
					freeze(false);
				}
			},
			'timeupdate':function(event){				
				syncTimeFromVideo();
				if (_clips[_clipIndex] !== undefined){
					_scrollSpeed = (event.target.duration * 60 * 1000) / _clips[_clipIndex].duration;
				}
			},
			'ended': function(event){
			        var loadingLong;
			    var cannotPlayTrigger;
				if (!_paused && !_seeking){
				    loadingLong = setTimeout(function(){
					_loadingIcon.show();
					_loadingIcon.animate({'opacity':0.8},100);
				    },400);
				    cannotPlayTrigger = setTimeout(function(){
					clearTimeout(loadingLong);
					if (_loadingIcon.is(':visible')){
					    _loadingIcon.animate({'opacity':0},50);
					    _loadingIcon.hide();
					}
					if (!_paused){
					    pause(true);
					}
				    },1000);
					if (showNextClip()){
					    var toStart = (event.target==_buf1[0])?_buf2:_buf1;
					    toStart.one('progress',function(e){
						clearTimeout(cannotPlayTrigger);
					    });
					    toStart.one('play', function(e){
						clearTimeout(cannotPlayTrigger);
						clearTimeout(loadingLong);
						if (_loadingIcon.is(':visible')){
						    _loadingIcon.animate({'opacity':0},50);
						    _loadingIcon.hide();
						}
					    });
					    toStart.get(0).play();
					}
					else {
						pause(true);
					}
				}
			},
			'progress': function(event){				
				var ranges = _visibleBuf.get(0).buffered.length;
				var i = 0;
				var bufferedFractions = [];
				var dur = _visibleBuf.get(0).duration;
				var bufferedTime = 0;
				for (i = 0;i < ranges;i++){
					bufferedFractions.push({
						start: Math.min(_visibleBuf.get(0).buffered.start(i)/dur,1),
						end: Math.min(_visibleBuf.get(0).buffered.end(i)/dur,1)
					});
					bufferedTime+=_visibleBuf.get(0).buffered.end(i)-_visibleBuf.get(0).buffered.start(i);
				}
				_clockLoadedPie.forEach(function(pie){
					pie.remove();
				});
				_clockLoadedPie.clear();
				if (bufferedTime < dur){
					_.each(bufferedFractions,function(frac){
						_clockLoadedPie.push(createSVGSector(_clockPaper, 50, 50, 45, frac.start*360, frac.end*360, {"fill": "#fafafa","stroke-width":0}));
					});
				}
				else {
					_clockLoadedPie.push(_clockPaper.circle(50,50,45).attr({"fill": "#fafafa","stroke-width":0}));
				}
				_clockRim.toFront();
				_clockHourHand.toFront();
				_clockMinHand.toFront();
			}
		};
		
		$(window).resize(function(){
			syncSizes();
		});
		
		$(document).on('keydown',function(e){
			if (keyDownBindings[e.keyCode] !== undefined){
				e.preventDefault();
				keyDownBindings[e.keyCode](e);		
			}
		});
		
		$(document).on('keyup',function(e){
			if (keyUpBindings[e.keyCode] !== undefined){
				e.preventDefault();
				keyUpBindings[e.keyCode]();		
			}
		});
		
		_glassPane.on('click', function(e){
			pause(!_paused);
		});
				
		_dayIndicator.on('click', function(e){
			e.stopPropagation();
			_scrollSpeed = 0;
			if (!_paused){
				freeze(true);				
			}
			if (_.isFunction(_daySelector)){
				_daySelector(_currentTime);
			}
		});

	    _playButton.on('click', function(e){
		e.stopPropagation();
		pause(!_paused);
	    });

	    _repeatButton.on('click', function(e){
		e.stopPropagation();
		toggleLooping();
	    });

	    _stepForwardButton.on('click', function(e){
		e.stopPropagation();
		jumpFwd(5*60*1000);
	    });

	    _stepBackwardButton.on('click', function(e){
		e.stopPropagation();
		jumpBack(5*60*1000);
	    });

	    _forwardButton.on('click', function(e){
		e.stopPropagation();
		jumpFwd(60*60*1000);
	    });

	    _backwardButton.on('click', function(e){
		e.stopPropagation();
		jumpBack(60*60*1000);
	    });

	    _fastForwardButton.on('click', function(e){
		e.stopPropagation();
		jumpToNext();
	    });

	    _fastBackwardButton.on('click', function(e){
		e.stopPropagation();
		jumpToPrev();
	    });
	    
	    _infoButton.on('click', function(e){		
		e.stopPropagation();
		if (!_paused) {
		    pause(true);
		}
		_aboutDialog.show(500);
		_aboutDialog.focus();
	    });

	    _infoDialog.on('click', function(e){
		e.stopPropagation();
		if (!_paused) {
		    pause(true);
		}
		_infoDialog.blur();
		_infoDialog.hide(300);
		pause(false);
	    });
		
		//Relies on jquery-mousewheel plugin:
		_glassPane.on('mousewheel', function(e){
			e.preventDefault();
			if(e.deltaY < 0) {
				_scrollSpeed= Math.min(Math.max(Math.round(Math.abs(e.deltaY)*0.1),1),60);
				jumpFwd();
			}
			else {
				_scrollSpeed = -Math.min(Math.max(Math.round(Math.abs(e.deltaY)*0.1),1),60);
				jumpBack();
			}
		});
		
		_.each(videoEvents, function(listener,name){
			_buf1.on(name, listener);
			_buf2.on(name, listener);
		});

	    window.addEventListener("hashchange", function(e){
		var hashTime = location.hash;
		var t;
		var wasPlaying = false;
		if (!_.isEmpty(hashTime)){
		    hashTime = hashTime.substring(1);
		    if (hashTime !== _myLastHashTime){
			t = moment(hashTime).utc();
			if (t.isValid()){
			    if (!_paused){
				wasPlaying = true;
				freeze(true);
			    }
			    jumpTo(t, function(){
				if (wasPlaying){
				    freeze(false);
				}
			    });
			}
		    }
		}
	    }, false);

	}
	
	function clampScrollingDown(){
		if (_scrollSpeed === 0) return;
		var fwd = (_scrollSpeed > 0);
		var minutes = moment(_currentTime).minute();
		var nextTickMinutes;
		var nextTick;
		_scrollSpeed = 0;
		if (fwd){
			nextTickMinutes = minutes + (5 - (minutes % 5));
			nextTick = moment(_currentTime).minutes(nextTickMinutes).seconds(0).milliseconds(0);
			jumpFwd(nextTick.diff(_currentTime));
		}
		else {
			nextTickMinutes = minutes - minutes % 5;
			nextTick = moment(_currentTime).minutes(nextTickMinutes).seconds(0).milliseconds(0);
			jumpBack(_currentTime.diff(nextTick));
		}
	}
	
	function syncSizes(){
		var w = _disp.width();
		var h = _disp.height();
		_glassPane.width(w);
		_glassPane.height(_disp.height());
		_pauseIcon.css('top',h/2-100);
		_pauseIcon.css('left',w/2-25);
		_playIcon.css('top',h/2-110);
		_playIcon.css('left',w/2-10);
	}
	
	function syncTimeFromVideo(){
		if (_clips[_clipIndex] !== undefined){
			if (_visibleBuf.get(0).seeking){
				_visibleBuf.one('seeked', function(event){
					syncTimeFromVideo();
				});
			}
			var timeFactor = _clips[_clipIndex].duration / _visibleBuf.get(0).duration;
			_currentTime=moment(_clips[_clipIndex].start.valueOf() + (_visibleBuf.get(0).currentTime * timeFactor));
			updateClock();
		    throttledHashUpdater();
		}
	}
	
	function jumpFwd(msecs){
	    if (_loading ||(msecs < 60000)) return true;
		var timeRatio = _visibleBuf.get(0).duration / _clips[_clipIndex].duration;
		var timeLeft = _visibleBuf.get(0).duration - _visibleBuf.get(0).currentTime;
		var loadingLong = null;
		if (msecs === undefined){
			msecs = _scrollSpeed * 60 * 1000;
			if (_paused) {
				debouncedClamper();
			}
		}
		drawLoop();
	    loadNextClipToBgBuf();
		if (timeLeft > msecs*timeRatio){
			loadingLong = setTimeout(function(){
				_loadingIcon.show();
				_loadingIcon.animate({'opacity':0.8},100);
			},400);
			_visibleBuf.get(0).currentTime=_visibleBuf.get(0).currentTime+msecs*timeRatio;
			whenCanPlay(_visibleBuf,function(){
				clearTimeout(loadingLong);
				if (_loadingIcon.is(':visible')){
					_loadingIcon.animate({'opacity':0},50);
					_loadingIcon.hide();
				}
			});
		}
		else {
			if (!showNextClip(Math.max(0,msecs*timeRatio-timeLeft))){
			//TODO: show notification
			}
		}
	    syncTimeFromVideo();
	}
	
	function jumpToNext(){
		if (_loading) return true;
		if (!showNextClip()){
			//TODO: show notification
		}
	}
	
	function jumpBack(msecs){
	    if (_loading ||(msecs < 60000)) return true;
		var loadingLong = null;
		var timeRatio = _visibleBuf.get(0).duration / _clips[_clipIndex].duration;
		if (msecs == undefined){
			msecs = -_scrollSpeed * 60 * 1000;
			if (_paused) {
				debouncedClamper();
			}
		}
		drawLoop();
	    loadPrevClipToBgBuf();
		if (_visibleBuf.get(0).currentTime > msecs*timeRatio){
			loadingLong = setTimeout(function(){
				_loadingIcon.show();
				_loadingIcon.animate({'opacity':0.8},100);
			},400);
			_visibleBuf.get(0).currentTime=_visibleBuf.get(0).currentTime-msecs*timeRatio;
			whenCanPlay(_visibleBuf,function(){
				clearTimeout(loadingLong);
				if (_loadingIcon.is(':visible')){
					_loadingIcon.animate({'opacity':0},50);
					_loadingIcon.hide();
				}
			});
		}
		else {
			if (!showPrevClip(Math.max(0,msecs*timeRatio-_visibleBuf.get(0).currentTime))){
				//Todo: show notification
			}
		}
		syncTimeFromVideo();
	}
	
	function jumpToPrev(){
		if (_loading) return true;
		if (!showPrevClip()){
			//pause(true);
		}
	}
	
	function jumpTo(time, callback){
		var toShow;
		var loadingLong;
		if (_clips[0].start.isBefore(time) && _clips[_clips.length-1].end.isAfter(time)){
			var selectedIndex = _.reduce(_clips, function(selectedIndex,clip,index){
				if (selectedIndex) {
					return selectedIndex;
				}
			    else if ( (clip.start.isSame(time) || clip.start.isBefore(time)) && clip.end.isAfter(time) ){
					return index;
				}
				else {
					return undefined;
				}
			},undefined);
		    if (selectedIndex !== undefined){
			if (selectedIndex === _clipIndex){
			    whenCanPlay(_visibleBuf, function(){
				var timeRatio = _visibleBuf.get(0).duration / _clips[_clipIndex].duration;
				var offset = time.diff(_clips[_clipIndex].start) * timeRatio;
				_visibleBuf.get(0).currentTime = offset;
			    });

			    drawLoop();
			    syncTimeFromVideo();
			    updateThumbnail(_currentTime);
			    loadNextClipToBgBuf();
			    if (callback){
				_.defer(callback);
			    }
			}
			else {
				toShow = (_buf1 == _visibleBuf)?_buf2:_buf1;
				_loading = true;
				loadingLong = setTimeout(function(){
					_loadingIcon.show();
					_loadingIcon.animate({'opacity':0.8},100);
				},200);
				loadClipToBuf(toShow,selectedIndex,function(){
					clearTimeout(loadingLong);
					if (_loadingIcon.is(':visible')){
						_loadingIcon.animate({'opacity':0},50);
						_loadingIcon.hide();
					}
					_loading = false;
					_visibleBuf = toShow;
				    _otherBufContainsNextInTime = false;
				    _otherBufContainsPrevInTime = false;
				    _clipIndex = selectedIndex;
				    whenCanPlay(_visibleBuf, function(){
					var timeRatio = _visibleBuf.get(0).duration / _clips[_clipIndex].duration;
					var offset = time.diff(_clips[_clipIndex].start) * timeRatio;
					_visibleBuf.get(0).currentTime = offset;
				    });

				    drawLoop();
				    syncTimeFromVideo();
				    updateThumbnail(_currentTime);
				    loadNextClipToBgBuf();
				    if (callback){
					callback();
				    }
				});
			}
		    }
		}
	    else {
		callback('invalid time');
	    }
	}
	
	function initClock(clock){
		_clockPaper = Raphael(clock.get(0),100, 100);
		_clockFace = _clockPaper.circle(50,50,45).attr({"fill":"#ffffff","stroke-width":0});
		_clockLoadedPie = _clockPaper.set();
		_clockRim = _clockPaper.circle(50,50,45).attr({"fill-opacity":0,"stroke":"#848484","stroke-width":"4"});
		_clockHourHand = _clockPaper.path("M50 50L50 27");
		_clockHourHand.attr({stroke: "#848484", "stroke-width": 4, "stroke-linecap": "square"});
		_clockMinHand = _clockPaper.path("M50 50L50 15");
		_clockMinHand.attr({stroke: "#848484", "stroke-width": 2, "stroke-linecap": "square"});
	}


	function loadVideoMetadata(callback){
		$.ajax({
			type: 'GET',
			url: _indexBaseUrl+'index.json',
			dataType: 'json',
			crossDomain: true,
			success: function( data ) {
				_clips = data.clips;
				_.each(_clips, function(clip,cIndex) {
					_clips[cIndex].start = moment.utc(_clips[cIndex].start);
					_clips[cIndex].end = moment.utc(_clips[cIndex].end);
					_clips[cIndex].duration = _clips[cIndex].end.diff(_clips[cIndex].start);
				});
				_clips = _.sortBy(_clips, function(clip){
					return clip.start.valueOf();
				});
				callback();
			},
			error: function(jqXHR, textStatus, errorThrown) {
				callback(textStatus);
			}
		});	
	}
	

	function freeze(freeze){
		if (freeze) {
			_visibleBuf.get(0).pause();
			_paused = true;
		}
		else if (_visibleBuf.get(0).paused){
			_visibleBuf.get(0).play();
			_paused = false;
			drawLoop();
			loadNextClipToBgBuf();
		}
	}
	
	function pause(pause){
		freeze(pause);
		if (pause) {
			debouncedClamper();
			_playIcon.hide();	
			_pauseIcon.show();
			_pauseIcon.animate({'opacity':0.5},50, function(){
				_pauseIcon.animate({'opacity':0.0},400, function(){
					_pauseIcon.hide();
				});
			});
		    _playButton.removeClass('active');
		}
		else {
			_pauseIcon.hide();
			_playIcon.show();
			_playIcon.animate({'opacity':0.5},50, function(){
				_playIcon.animate({'opacity':0.0},400, function(){
					_playIcon.hide();
				});
			});
		    _playButton.addClass('active');
		}
	}

    function toggleLooping(){
	_looping = !_looping;
	if (_looping){
	    _repeatButton.addClass('active');
	}
	else {
	    _repeatButton.removeClass('active');
	}
    }

	function showNextClip(offset){
		var toShow = (_buf1 == _visibleBuf)?_buf2:_buf1;
	    var nextIndex;
		if (!_looping && (_clipIndex == (_clips.length - 1))){
			return false;
		}
		else {
			nextIndex = (_clipIndex + 1) % _clips.length;
			_loading = true;
			var wasPlaying = false;
			var loadingLong = setTimeout(function(){
				wasPlaying = !_paused;
				if (wasPlaying) {
					freeze(true);
				}
				_loadingIcon.show();
				_loadingIcon.animate({'opacity':0.8},100);
			},500);
			loadClipToBuf(toShow,nextIndex,function(){
				clearTimeout(loadingLong);
				if (_paused && wasPlaying) {
					freeze(false);
				}
				if (_loadingIcon.is(':visible')){
					_loadingIcon.animate({'opacity':0},50);
					_loadingIcon.hide();
				}
				_loading = false;

				try {
				    if (!offset) {
					toShow.get(0).currentTime = 0;
				    }
				    else {
					toShow.get(0).currentTime = Math.min(toShow.get(0).duration,offset);
				    }
				} catch (exception){
				    //NOOP
				}
			    _clipIndex = nextIndex;
				_visibleBuf = toShow;
			    _otherBufContainsNextInTime = false;
			    _otherBufContainsPrevInTime = true;
				syncTimeFromVideo();
				updateThumbnail(_currentTime);
				loadNextClipToBgBuf();
			});
			return true;
		}
	}

	function showPrevClip(offset){
		var toShow = (_buf1 == _visibleBuf)?_buf2:_buf1;
	    var nextIndex;
		if (!_looping && (_clipIndex === 0)){
			return false;
		}
		else {
			nextIndex = (_clipIndex - 1);
			if (_clipIndex == -1){
				_clipIndex = _clips.length - 1;
			}
			_loading = true;
			var wasPlaying = false;
			var loadingLong = setTimeout(function(){
				wasPlaying = !_paused;
				if (wasPlaying) {
					freeze(true);
				}
				_loadingIcon.show();
				_loadingIcon.animate({'opacity':0.8},100);
			},500);
			loadClipToBuf(toShow,nextIndex,function(){
				clearTimeout(loadingLong);
				if (_paused && wasPlaying) {
					freeze(false);
				}
				if (_loadingIcon.is(':visible')){
					_loadingIcon.animate({'opacity':0},50);
					_loadingIcon.hide();
				}
				_loading = false;
				_rewinding = true;
				setTimeout(function(){
					_rewinding = false;
					drawLoop();
				},300);
			    try {
				if (!offset){
					toShow.get(0).currentTime = toShow.get(0).duration;
				}
				else {
					toShow.get(0).currentTime = Math.max(0,toShow.get(0).duration-offset);
				}
			    } catch (exception){
				//NOOP
			    }
			    _clipIndex = nextIndex;
				_visibleBuf = toShow;
			    _otherBufContainsNextInTime = true;
			    _otherBufContainsPrevInTime = false;
				syncTimeFromVideo();
				updateThumbnail(_currentTime);
				loadPrevClipToBgBuf();
			});
			return true;
		}
	}

	function updateThumbnail(t){
	    var url = getMonthThumbsUrl(t);
	    if (_thumbnail.css('background-image') != 'url('+url+')'){
		_thumbnail.css({'background-image':'url('+getMonthThumbsUrl(t)+')','background-position':getMonthThumbSpritePos(t)+'px 0px'});
	    }	    
	    _thumbnail.animate(
		{'background-position-x':'-'+getMonthThumbSpritePos(t)},
		{
		    step: function(now,fx){
			$(fx.elem).css({'background-position':now+'px 0px'});
		    },
		    duration: 500	   
		}
	    );
	}
	
	function getMonthThumbsUrl(time){
		if (_monthThumbsUrlResolver){
			return _monthThumbsUrlResolver(time);
		}
		else {
			return '';
		}
	}
	
	function getMonthThumbSpritePos(time){
		var dayOfMonth = time.date();
		return (dayOfMonth-1)*_thumbWidth;
	}
	
	function drawLoop() {
		if (_visibleBuf){
			if (!_rewinding) {
				if (_visibleBuf.get(0).readyState == 4){					
					_dispCtx.drawImage(_visibleBuf.get(0),0,0);
					_dispCtx.fillStyle="#fefefe";
					_dispCtx.fillRect(0,0,280,15);
					_dispCtx.fillRect(1200,0,1280,600);
				}
			}
			if (!_paused) {
				requestAnimationFrame(drawLoop);
			}
		}
	}


	function updateClock(){		
		var dayStart = moment(_currentTime).startOf('day');
		var hourStart = moment(_currentTime).startOf('hour');
		var hours = _currentTime.diff(dayStart,'minute')/60;
		var minutes = _currentTime.diff(hourStart,'minute');
		var roundedTime = moment(_currentTime).minutes();
		_clockHourHand.transform("R"+(15*hours+",50,50"));
		_clockMinHand.transform("R"+(6*minutes)+",50,50");
		if (Math.abs(_scrollSpeed) > 10){
			_clockMinHand.attr({stroke: "#f4f4f4"});
		}
		else {
			_clockMinHand.attr({stroke: "#848484"});
		}
		_timeLabel.text(_currentTime.format("lll"));
	}

	function loadNextClipToBgBuf(){
	    if (!_otherBufContainsNextInTime){
		var toLoad = (_buf1 == _visibleBuf)?_buf2:_buf1;
		var nextClipIndex;
		if (_clipIndex === _clips.length - 1){
		    if (_looping){
			nextClipIndex = 0;
		    }
		    else {
			return;
		    }
		}
		else {
		    nextClipIndex = _clipIndex + 1;
		}
		_otherBufContainsNextInTime = true;
		_otherBufContainsPrevInTime = false;
		loadClipToBuf(toLoad,nextClipIndex);
	    }
	}

	function loadPrevClipToBgBuf(){
	    if (!_otherBufContainsPrevInTime){
		var toLoad = (_buf1 == _visibleBuf)?_buf2:_buf1;
		var prevClipIndex;
		if (_clipIndex === 0){
		    if (_looping){
			prevClipIndex = _clips.length - 1; 
		    }
		    else {
			return;
		    }
		}
		else {
		    prevClipIndex = _clipIndex - 1;
		}
		_otherBufContainsPrevInTime = true;
		_otherBufContainsNextInTime = false;
		loadClipToBuf(toLoad,prevClipIndex);
	    }
	}

	function loadClipToBuf(buf,index,cb){
	    var poller = function(buf,cb){
		if (_.isFunction(cb) && buf && buf.get(0) && !buf.get(0).error){
		    if (buf.get(0).readyState > 0){
			cb();
		    }
		    else {
			setTimeout(function(){
			    poller(buf,cb);
			},200);
		    }
		}
	    };
	    if (buf.attr('data-fname') != _clips[index].fname){
			buf.attr('data-fname',_clips[index].fname);
			buf.empty();
			var source = $('<source></source>').attr('type','video/mp4').attr('src',_baseUrl+_clips[index].fname+'.mp4');
			buf.append(source);
			source = $('<source></source>').attr('type','video/webm').attr('src',_baseUrl+_clips[index].fname+'.webm');
			buf.append(source);
			source.on('error', function(){
			    if (_errorDialog){
				_errorDialog.show(500);
				_errorDialog.focus();
			    }
			});
			buf.get(0).load();
			poller(buf,cb);		    
	    }
	    else {
		if (cb){
		    _.defer(cb);
		}
	    }

	}
	
	function whenCanPlay(buf,cb){
		if (buf.get(0).readyState < 4){
			buf.one('canplay', cb);
		}
		else {
			_.defer(cb);
		}
	}
	
	function createSVGSector(paper, cx, cy, r, startAngle, endAngle, params) {
		var start = polarToCartesian(cx, cy, r, endAngle);
		var end = polarToCartesian(cx, cy, r, startAngle);
		var arcSweep = endAngle - startAngle <= 180 ? "0" : "1";
		return paper.path(["M", cx, cy, "L", start.x, start.y, "A", r, r, 0, arcSweep, 0, end.x, end.y, "z"]).attr(params);
	}
	
	function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
	  var angleInRadians = (angleInDegrees-90) * Math.PI / 180.0;

	  return {
	    x: centerX + (radius * Math.cos(angleInRadians)),
	    y: centerY + (radius * Math.sin(angleInRadians))
	  };
	}


    radArchConst = function(containers, options, callback){
	if (options.videoBaseUrl){
	    _baseUrl = options.videoBaseUrl;
	}

	if (options.indexBaseUrl){
	    _indexBaseUrl = options.indexBaseUrl;
	}

	if (_.isFunction(options.thumbnailProvider)){
	    _monthThumbsUrlResolver = options.thumbnailProvider;	    
	}

	if (options.errorDialog){
	    _errorDialog = options.errorDialog;
	}
	if (options.aboutDialog){
	    _aboutDialog = options.aboutDialog;
	}
		init(containers);
		_visibleBuf = _buf2;
		_clipIndex = -1;
		_loading = true;
	_paused = true;
		_loadingIcon.show();
		_loadingIcon.animate({'opacity':0.8},100);
		loadVideoMetadata(function(err){
			_loadingIcon.animate({'opacity':0},100);
			_loadingIcon.hide();
			_loading = false;
			if (err){
			    console.error(err);
			}
			else {			    
			    var date = location.hash;			    
			    var t;
			    if (date){
				t = moment(date.substring(1));
				if (t.isValid()){
				    jumpTo(t, function(err){
					if (!err) { 
					    if (callback){
						callback(err);					    
					    }
					}
					else {
					    jumpTo(moment().startOf('day').subtract(2,'days'), function(err){
						if (callback){
						    callback(err);
						}
					    });
					}
				    });
				}
				else {
				    t = undefined;
				}
			    }
			    if (!t){
				jumpTo(moment().startOf('day').subtract(2,'days'), function(err){
				    if (callback){
					callback(err);
				    }
				});

			    }
			}
		});
	};

	radArchConst.prototype.setTime = function(time, callback){
		jumpTo(time, callback);
	};
	
	radArchConst.prototype.registerCalendarComponent = function(selector){
		if (_.isObject(selector)) {
			if (_.isFunction(selector.open)){
				_daySelector = selector.open;
			}
			if (_.isFunction(selector.addSelectionListener)){
				selector.addSelectionListener(function(time){
				    jumpTo(time,function(err){
					if (!err){
					    _playButton.addClass('active');
					    pause(false);
					}
					});
				});
			}
		}
	}
	
	return radArchConst;
	})();