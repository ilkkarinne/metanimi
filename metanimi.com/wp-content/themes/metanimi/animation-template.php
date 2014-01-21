<?php
/*
Template Name: Animation
*/
?>
<?php get_header( 'animation' ); ?>
<?php if ( have_posts() ) while ( have_posts() ) : the_post(); ?>
<div role="main" class="primary-content" id="post-<?php the_ID(); ?>">
  <div id="container"></div>
  <div id="logo">
    <h2><?php the_title(); ?></h2>
  </div>
  <div id="calcontainer" tabindex="-1"></div>
  <div id="loaderror" tabindex="-1">
       <h3>Error loading video<i class="close-button fa fa-times-circle"></i></h3>
       <p>Unfortunately your browser was unable to load the animation video either in webm or mp4 format.
       Please check your network connection and try to reload the page.
       </p>
  </div>
  <div id="about" tabindex="-1">
       <h3>About <?php the_title(); ?><i class="close-button fa fa-times-circle"></i></h3>
       <?php the_content(); ?>
  </div>
  <?php endwhile; ?>
</div><!-- #primary -->
<?php get_footer( 'animation' ); ?>