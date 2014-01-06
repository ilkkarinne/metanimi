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
	var _looping = false;
	var _clockPaper;
	var _clockHourHand;
	var _clockMinHand;
	var _clockLoadedPie;
	var _clockFace;
	var _clockRim;
	var _timeLabel;
	var _daySelector;
	var _monthThumbsUrlResolver;
	var _momentumDamperTimer;
	var radArchConst;
	
	var debouncedSeekStart = _.debounce(function(){
		if (!_seeking){
			_seeking = true;
			_wasPlayingBeforeSeek = !_paused;
			if (_wasPlayingBeforeSeek) freeze(true);
		}
	},150, true);
	
	var debouncedClamper = _.debounce(clampScrollingDown,100);
	
	function init(containers){
		_disp = $('<canvas></canvas>').attr('style','position:absolute;top:0;left:0;max-width:'+_width+'px;max-height:'+_height+'px;height:100%');
		_clock = $('<div></div>').addClass('clock').attr('style','z-index:100');

		_glassPane = $('<div></div>').attr('style','position:absolute;top:0;left:0;max-width:'+_width+'px;max-height:'+_height+'px;z-index:20');

		_pauseIcon = $('<div></div>').attr('style','position:relative;top:0;left:0;width:25px;height:150px;border-left:35px solid black;border-right:35px solid black;opacity:0');
		_glassPane.append(_pauseIcon);
		_pauseIcon.hide();
		
		_playIcon = $('<div></div>').attr('style','position:relative;top:0;left:0;width:0;height:0;border-top:80px solid transparent;border-bottom:80px solid transparent;border-left:85px solid black;opacity:0');
		_glassPane.append(_playIcon);
		_playIcon.hide();
		
		_loadingIcon = $('<div>Loading, please wait&hellip;</div>').attr('style','position:relative;top:50%;left:50%;width:16em;height:2em;margin-left:-8em;margin-top:-1em;font-size:20pt;font-family: Helvetica,Arial,sans-serif;opacity:0;text-align:center');
		_glassPane.append(_loadingIcon);
		_loadingIcon.hide();
		
		_glassPane.append(_clock);

		_buf1 = $('<video></video>').attr({'style':'width:'+_width+'px;height:'+_height+'px;','id':'buf1'});
		_buf2 = $('<video></video>').attr({'style':'width:'+_width+'px;height:'+_height+'px;','id':'buf2'});

		_dispCtx = _disp.get(0).getContext('2d');
		
		_dayIndicator = $('<div></div>').css({'z-index':100,'font-family':'Helvetica, Arial, sans-serif','font-size':'13px','color':'#848484'}).addClass('dayindicator');
		_thumbnail = $('<div></div>').css({
			'width':_thumbWidth+'px',
			'height':_thumbHeight+'px',
			'background-position-y':'0px',
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
		
		_disp.get(0).width = _width;
		_disp.get(0).height = _height;

		containers.append(_disp);
		containers.append(_glassPane);

		initClock(_clock);
		syncSizes();

		var keyDownBindings = {
			39: function(event){ //arrow fwd
				if (event.shiftKey){
					jumpFwd(60*60*1000);
				}
				else {
					jumpFwd(5*60*1000);
				}
			},
			37: function(event){ //arrow back
				if (event.shiftKey){
					jumpBack(60*60*1000);
				}
				else {
					jumpBack(5*60*1000);
				}
			},
			40: function(event){ //arrow down
				if (event.shiftKey){
					jumpFwd(60*60*1000);
				}
				else {
					jumpFwd(5*60*1000);
				}
			},
			38: function(event){ //arrow up
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
				if (!_paused && !_seeking){
					if (showNextClip()){
						var toStart = (event.target==_buf1[0])?_buf2:_buf1;
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
		
		_clock.on('click', function(e){
			e.stopPropagation();
			_scrollSpeed = 0;
			if (!_paused) {
				pause(true);				
			}
			if (_.isFunction(_daySelector)){
				_daySelector(_currentTime);
			}
		});
		
		_dayIndicator.on('click', function(e){
			e.stopPropagation();
			_scrollSpeed = 0;
			if (!_paused){
				pause(true);				
			}
			if (_.isFunction(_daySelector)){
				_daySelector(_currentTime);
			}
		});
		
		//Relies on jquery-mousewheel plugin:
		_glassPane.on('mousewheel', function(e){
			e.preventDefault();
			if(e.deltaY > 0) {
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
		}
	}
	
	function jumpFwd(msecs){
		if (_loading) return true;
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
		if (timeLeft > msecs*timeRatio){
			loadingLong = setTimeout(function(){
				_loadingIcon.show();
				_loadingIcon.animate({'opacity':0.8},100);
			},200);
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
		if (_loading) return true;
		var loadingLong = null;
		var timeRatio = _visibleBuf.get(0).duration / _clips[_clipIndex].duration;
		if (msecs == undefined){
			msecs = -_scrollSpeed * 60 * 1000;
			if (_paused) {
				debouncedClamper();
			}
		}
		drawLoop();
		if (_visibleBuf.get(0).currentTime > msecs*timeRatio){
			loadingLong = setTimeout(function(){
				_loadingIcon.show();
				_loadingIcon.animate({'opacity':0.8},100);
			},200);
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
				else if ((clip.start.isSame(time) || clip.start.isBefore(time)) && clip.end.isAfter(time)){
					return index;
				}
				else {
					return undefined;
				}
			},undefined);
			if (selectedIndex !== undefined){
				toShow = (_buf1 == _visibleBuf)?_buf2:_buf1;
				_clipIndex = selectedIndex;
				_loading = true;
				loadingLong = setTimeout(function(){
					_loadingIcon.show();
					_loadingIcon.animate({'opacity':0.8},100);
				},200);
				loadClipToBuf(toShow,_clipIndex,function(){
					clearTimeout(loadingLong);
					if (_loadingIcon.is(':visible')){
						_loadingIcon.animate({'opacity':0},50);
						_loadingIcon.hide();
					}
					_loading = false;
					toShow.get(0).currentTime = 0;
					_visibleBuf = toShow;
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
	
	function initClock(clock){
		_clockPaper = Raphael(clock.get(0),100, 100);
		_clockFace = _clockPaper.circle(50,50,45).attr({"fill":"#ffffff","stroke-width":0});
		_clockLoadedPie = _clockPaper.set();
		_clockRim = _clockPaper.circle(50,50,45).attr({"fill-opacity":0,"stroke":"#a4a4a4","stroke-width":"4"});
		_clockHourHand = _clockPaper.path("M50 50L50 27");
		_clockHourHand.attr({stroke: "#a4a4a4", "stroke-width": 4, "stroke-linecap": "square"});
		_clockMinHand = _clockPaper.path("M50 50L50 15");
		_clockMinHand.attr({stroke: "#a4a4a4", "stroke-width": 2, "stroke-linecap": "square"});
	}


	function loadVideoMetadata(callback){
		$.ajax({
			type: 'GET',
			url: _baseUrl+'index.json',
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
		}
		else {
			_pauseIcon.hide();
			_playIcon.show();
			_playIcon.animate({'opacity':0.5},50, function(){
				_playIcon.animate({'opacity':0.0},400, function(){
					_playIcon.hide();
				});
			});
		}
	}


	function showNextClip(offset){
		var toShow = (_buf1 == _visibleBuf)?_buf2:_buf1;
		if (!_looping && (_clipIndex == (_clips.length - 1))){
			return false;
		}
		else {
			_clipIndex = (_clipIndex + 1) % _clips.length;
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
			loadClipToBuf(toShow,_clipIndex,function(){
				clearTimeout(loadingLong);
				if (_paused && wasPlaying) {
					freeze(false);
				}
				if (_loadingIcon.is(':visible')){
					_loadingIcon.animate({'opacity':0},50);
					_loadingIcon.hide();
				}
				_loading = false;
				if (!offset){
					toShow.get(0).currentTime = 0;
				}
				else {
					toShow.get(0).currentTime = Math.min(toShow.get(0).duration,offset);
				}
				_visibleBuf = toShow;
				syncTimeFromVideo();
				updateThumbnail(_currentTime);
				loadNextClipToBgBuf();
			});
			return true;
		}
	}

	function showPrevClip(offset){
		var toShow = (_buf1 == _visibleBuf)?_buf2:_buf1;
		if (!_looping && (_clipIndex === 0)){
			return false;
		}
		else {
			_clipIndex = (_clipIndex - 1);
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
			loadClipToBuf(toShow,_clipIndex,function(){
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
				if (!offset){
					toShow.get(0).currentTime = toShow.get(0).duration;
				}
				else {
					toShow.get(0).currentTime = Math.max(0,toShow.get(0).duration-offset);
				}
				_visibleBuf = toShow;
				syncTimeFromVideo();
				updateThumbnail(_currentTime);
				loadPrevClipToBgBuf();
			});
			return true;
		}
	}

	function updateThumbnail(t){
		_thumbnail.css({'background-image':'url('+getMonthThumbsUrl(t)+')','background-position-x':0});
		_thumbnail.animate({'background-position-x':'-'+getMonthThumbSpritePos(t)},500);
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
				if (_visibleBuf.get(0).readyState = 4){					
					_dispCtx.drawImage(_visibleBuf.get(0),0,0);
					_dispCtx.fillStyle="#ffffff";
					_dispCtx.fillRect(0,0,280,12);
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
			_clockMinHand.attr({stroke: "#a4a4a4"});
		}
		_timeLabel.text(_currentTime.format("DD.MM.YYYY HH:mm"));
	}

	function loadNextClipToBgBuf(){
		var toLoad = (_buf1 == _visibleBuf)?_buf2:_buf1;
		var nextClipIndex = (_clipIndex + 1) % _clips.length;
		loadClipToBuf(toLoad,nextClipIndex);
	}

	function loadPrevClipToBgBuf(){
		var toLoad = (_buf1 == _visibleBuf)?_buf2:_buf1;
		var prevClipIndex = _clipIndex - 1;
		if (prevClipIndex == -1){
			prevClipIndex = _clips.length - 1;
		}
		loadClipToBuf(toLoad,prevClipIndex);
	}

	function loadClipToBuf(buf,index,cb){
		if (buf.attr('data-fname') != _clips[index].fname){
			buf.attr('data-fname',_clips[index].fname);
			buf.empty();
			var source = $('<source></source>').attr('type','video/webm').attr('src',_baseUrl+_clips[index].fname);
			buf.append(source);
			source.on('error', function(){
				console.log('Error loading video from '+_baseUrl+_clips[index].fname);
				setTimeout(function(){
					console.log('trying to skip this clip');
					jumpToNext();
				},1000);
			});
			buf.get(0).load();
		}
		if (cb){
			if (buf.get(0).readyState > 0){
				_.defer(cb);
			}
			else {
				buf.one('loadedmetadata',function(){
					cb();
				});
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

	radArchConst = function(containers,baseUrl,thumbnailProvider, callback){
		_baseUrl = baseUrl;
		if (_.isFunction(thumbnailProvider)){
			_monthThumbsUrlResolver = thumbnailProvider;			
		}
		
		init(containers);
		_visibleBuf = _buf2;
		_clipIndex = -1;
		_loading = true;
		_loadingIcon.show();
		_loadingIcon.animate({'opacity':0.8},100);
		_buf1.one('canplaythrough', function(){
			_loadingIcon.animate({'opacity':0},100);
			_loadingIcon.hide();
			_loading = false;

			if (showNextClip()){
				drawLoop();
				syncTimeFromVideo();
				updateThumbnail(_currentTime);
				if (callback){
					callback();
				}
			}
		});

		loadVideoMetadata(function(err){
			_loading = false;
			if (err){
				//Show error
			}
			else {
				loadClipToBuf(_buf1,0);
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
					jumpTo(time);
				});
			}
		}
	}
	
	return radArchConst;
	})();