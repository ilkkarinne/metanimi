<?php ?>
<!DOCTYPE html>
<!--[if IE 9 ]><html lang="en" class="ie ie9"> <![endif]-->
<!--[if (gt IE 9)|!(IE)]><!--> <html <?php language_attributes(); ?> class="no-js"> <!--<![endif]-->
<head>
<title><?php
	global $page, $paged;
	wp_title( '|', true, 'right' );
		bloginfo( 'name' );
		$site_description = get_bloginfo( 'description', 'display' );
		if ( $site_description && ( is_home() || is_front_page() ) )
			echo " | $site_description";
		if ( $paged >= 2 || $page >= 2 )
			echo ' | ' . sprintf( __( 'Page %s' ), max( $paged, $page ) );
	?>
</title>
<meta name="description" content="<?php if ( is_page() ) {
	echo get_post_meta($wp_query->post->ID,'meta_description',true);
	} else {
	bloginfo('name'); echo " - "; bloginfo('description');
	}
?>" />
<meta charset="<?php bloginfo( 'charset' ); ?>" />
<meta name="viewport" content="width=device-width" />
<meta property="og:title" content="<?php echo wp_title('',false); ?>"/>
<meta property="og:description" content="<?php if ( is_page() ) {
	echo get_post_meta($wp_query->post->ID,'meta_description',true);
	} else {
	bloginfo('name'); echo " - "; bloginfo('description');
	}
?>" />
<meta property="og:type" content="website"/>
<meta property="og:url" content="<?php echo get_permalink($wp_query->post->ID);?>"/>
<meta property="og:image" content="http://metanimi.com/<?php echo get_post($wp_query->post->ID)->post_name; ?>-thumb.png"/>
<!-- The little things -->
	<link rel="profile" href="http://gmpg.org/xfn/11" />
	<link rel="pingback" href="<?php bloginfo( 'pingback_url' ); ?>" />
    <link rel="shortcut icon" href="<?php echo bloginfo('template_directory'); ?>/favicon.png">
	<link rel="apple-touch-icon" href="<?php echo bloginfo('template_directory'); ?>/apple-touch-icon-precomposed.png"/>
<!-- The little things -->

<!-- Stylesheets -->
	<link rel="stylesheet" href="<?php bloginfo( 'stylesheet_url' ); ?>" />
	<link rel="stylesheet" href="<?php bloginfo( 'template_directory' ); ?>/animation.css" />
	<link rel="stylesheet" href="//netdna.bootstrapcdn.com/font-awesome/4.0.3/css/font-awesome.css">
<!-- Stylesheets -->

    <script type="text/javascript" src="<?php echo bloginfo('template_directory'); ?>/js/modernizr.custom.58721.js"></script>
    <script type="text/javascript" src="//cdnjs.cloudflare.com/ajax/libs/jquery/1.9.1/jquery.min.js"></script>
    <script type="text/javascript" src="//cdnjs.cloudflare.com/ajax/libs/jquery-mousewheel/3.1.6/jquery.mousewheel.min.js"></script>
    <script type="text/javascript" src="//cdnjs.cloudflare.com/ajax/libs/lodash.js/2.4.1/lodash.min.js"></script>
    <script type="text/javascript" src="//cdnjs.cloudflare.com/ajax/libs/moment.js/2.5.0/moment.min.js"></script>
    <script type="text/javascript" src="//cdnjs.cloudflare.com/ajax/libs/raphael/2.1.2/raphael-min.js"></script>

    <script type="text/javascript" src="<?php echo bloginfo('template_directory'); ?>/js/video-animator.js?ver=2014-01-21T20-28"></script>
    <script type="text/javascript" src="<?php echo bloginfo('template_directory'); ?>/js/scrolling-calendar.js?ver=2014-01-21T20-28"></script>
    <?php wp_deregister_script('jquery');wp_head(); ?>
		<script type="text/javascript">
		function getMissingCapabilities(){
			var missing = [];
			if (Modernizr){
				if (!Modernizr.canvas){
					missing.push('canvas');		
				}			
				if (!Modernizr.video){
					missing.push('video');
					if (!Modernizr.video.webm && !Modernizr.video.mp4){
							missing.push('format');
					}
				}
			}
			else {
				missing.push('modernizr');
			}
			return missing;
		}
		</script>
    <script type="text/javascript">
  $(function() {
		var missingCaps = getMissingCapabilities();
		if (missingCaps.length === 0){
			$('.missing-capabilities').hide();
  		var thumbsBaseUrl = "<?php echo get_post_meta($wp_query->post->ID,'thumbs_base_url',true); ?>";
			var videoBaseUrl = "<?php echo get_post_meta($wp_query->post->ID,'video_base_url',true); ?>";
			var indexBaseUrl = "<?php echo get_post_meta($wp_query->post->ID,'index_base_url',true); ?>";
			var start = moment('<?php echo get_post_meta($wp_query->post->ID,'start_day',true); ?>','YYYY-MM-DD');
			var end = moment().startOf('day');
			var thumbnailProvider = function(time){
			if (time && time.isAfter(start) && time.isBefore(end)){
					return thumbsBaseUrl+'thumbs_'+time.format('YYYY-MM')+".png";
				}
				else {
					return "";
				}
			};
		
    	var anim = new com.metanimi.VideoAnimator($('#container'),
    		{
					videoBaseUrl: videoBaseUrl,
					indexBaseUrl: indexBaseUrl,
					thumbnailProvider: thumbnailProvider,
					errorDialog: $('#loaderror'),
					aboutDialog: $('#about')       
				});
				var cal = new com.metanimi.ScrollingCalendar($('#calcontainer'),start,end,thumbnailProvider);
		
				anim.registerCalendarComponent({
					open: function(currentTime){
						$('#calcontainer').show(500,function(){
							cal.scrollTo(currentTime);						
						});
						$('#calcontainer').focus();
					},
					addSelectionListener: function(listener){
						cal.addSelectionListener(function(time){
							$('#calcontainer').blur();
							$('#calcontainer').hide(300, function(){
							if (time){
							   listener(time);
							   if (ga){
							      ga('send','event','Jump',time.format(),'Calendar selection');
							   }								
							}

							});
						});
					}
				});
		}
		$('#logo').on('click',function(){
			window.location.assign('/');
		});
		$('#calcontainer,#loaderror,#about').on('keydown', function(e){
			if (e.keyCode === 27){
			   e.preventDefault();
			   $(e.target).blur().hide(300);
			}
		});
		$('#about .close-button').on('click', function(e){
			   e.stopPropagation();
			  $('#about').blur().hide(300);
		});
		$('#loaderror .close-button').on('click', function(e){
			   e.stopPropagation();
			  $('#loaderror').blur().hide(300);
		});
  });
</script>

<script>
  (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
  (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
  m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
  })(window,document,'script','//www.google-analytics.com/analytics.js','ga');

  ga('create', 'UA-46653983-1', 'metanimi.com');
  ga('send', 'pageview');

</script>
<script type="text/javascript">
var addthis_config = addthis_config||{};
addthis_config.data_track_addressbar = false;
addthis_config.data_track_clickback = false;
addthis_config.data_ga_property = 'UA-46653983-1';
</script>
</head>

<body <?php body_class(); ?> id="top">
      <div class="meta">
      	   <img src="" alt="metanimi" title="Metanimi" />
      </div>
      <div class="animation-container">
	<div class="missing-capabilities">
		<h2>So sorry to disappoint, but&hellip;</h2>
		<p>This application requires modern browser technologies to deliver a smooth video-based animation. 
		Unfortunately the app cannot work without this machinery, and it seems that your browser 
		does not support some parts of it:</p>
		<ul>
			<li>Javascript</li>
			<li>Broadband internet connection</li>
			<li><a href="https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/Canvas_tutorial">HTML5 Canvas</a></li>
			<li><a href="https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/Using_HTML5_audio_and_video">HTML5 Video</a> with <a href="http://www.webmproject.org/">Webm format</a> support</li>
		</ul>
		<p>If possible, please switch to the newest versions of Chrome, Firefox Safari or IE and, if necessary, install the Webm video codec to get the full experience.</p>
	</div>