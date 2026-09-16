<?php
/**
 * Maps management admin page view.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$action = isset( $_GET['action'] ) ? sanitize_text_field( $_GET['action'] ) : 'list';
$map_id = isset( $_GET['map_id'] ) ? intval( $_GET['map_id'] ) : 0;

$map_to_edit = null;
if ( 'edit' === $action ) {
	if ( $map_id > 0 ) {
		$post = get_post( $map_id );
		if ( $post && 'eo-map' === $post->post_type ) {
			$settings = get_post_meta( $post->ID, '_eo_map_settings', true );
			$markers  = get_post_meta( $post->ID, '_eo_map_markers', true );

			$map_to_edit = array(
				'id'       => $post->ID,
				'title'    => $post->post_title,
				'settings' => is_array( $settings ) ? $settings : array(),
				'markers'  => is_array( $markers ) ? $markers : array(),
			);
		} else {
			$action = 'list'; // fallback
		}
	} else {
		// Initialize default structure for new maps
		$map_to_edit = array(
			'id'       => 0,
			'title'    => '',
			'settings' => array(
				'width'     => '100%',
				'height'    => '600px',
				'zoom'      => 12,
				'minZoom'   => 0,
				'maxZoom'   => 19,
				'centerLat' => 43.6107,
				'centerLng' => 3.8767,
				'tileStyle' => 'osm',
				'mapLanguage' => 'local',
				'mapDesign' => 'positron',
			),
			'markers'  => array(),
		);
	}
}

// Get all maps for list view
$maps_query = new WP_Query( array(
	'post_type'      => 'eo-map',
	'posts_per_page' => -1,
	'post_status'    => 'publish',
) );

$all_maps = array();
if ( $maps_query->have_posts() ) {
	foreach ( $maps_query->posts as $post ) {
		$settings = get_post_meta( $post->ID, '_eo_map_settings', true );
		$markers  = get_post_meta( $post->ID, '_eo_map_markers', true );
		$all_maps[] = array(
			'id'       => $post->ID,
			'title'    => $post->post_title,
			'settings' => is_array( $settings ) ? $settings : array(),
			'markers'  => is_array( $markers ) ? $markers : array(),
		);
	}
}
wp_reset_postdata();

?>
<div class="wrap eo-maps-admin-wrapper">
	<h1 class="wp-heading-inline"><?php esc_html_e( 'EO Blocks - Cartes Interactives', 'eo-blocks' ); ?></h1>
	
	<?php if ( 'list' === $action ) : ?>
		<a href="?page=eo-blocks-maps&action=edit&map_id=0" class="page-title-action"><?php esc_html_e( 'Créer une carte', 'eo-blocks' ); ?></a>
		<hr class="wp-header-end">

		<div class="eo-maps-list-container">
			<table class="wp-list-table widefat fixed striped table-view-list posts">
				<thead>
					<tr>
						<th scope="col" class="column-id"><?php esc_html_e( 'IDENTIFIANT', 'eo-blocks' ); ?></th>
						<th scope="col" class="column-title"><?php esc_html_e( 'Titre', 'eo-blocks' ); ?></th>
						<th scope="col" class="column-width"><?php esc_html_e( 'Largeur', 'eo-blocks' ); ?></th>
						<th scope="col" class="column-height"><?php esc_html_e( 'Hauteur', 'eo-blocks' ); ?></th>
						<th scope="col" class="column-markers"><?php esc_html_e( 'Marqueurs', 'eo-blocks' ); ?></th>
						<th scope="col" class="column-shortcode"><?php esc_html_e( 'Code court', 'eo-blocks' ); ?></th>
						<th scope="col" class="column-actions"><?php esc_html_e( 'Action', 'eo-blocks' ); ?></th>
					</tr>
				</thead>
				<tbody>
					<?php if ( empty( $all_maps ) ) : ?>
						<tr>
							<td colspan="7" style="text-align: center; padding: 20px;">
								<?php esc_html_e( 'Aucune carte n\'a été créée pour le moment. Cliquez sur "Créer une carte" pour commencer.', 'eo-blocks' ); ?>
							</td>
						</tr>
					<?php else : ?>
						<?php foreach ( $all_maps as $map ) : ?>
							<?php 
								$width = $map['settings']['width'] ?? '100%';
								$height = $map['settings']['height'] ?? '600px';
								$markers_count = is_array( $map['markers'] ) ? count( $map['markers'] ) : 0;
							?>
							<tr>
								<td><?php echo esc_html( $map['id'] ); ?></td>
								<td><strong><a href="?page=eo-blocks-maps&action=edit&map_id=<?php echo esc_attr( $map['id'] ); ?>"><?php echo esc_html( $map['title'] ); ?></a></strong></td>
								<td><?php echo esc_html( $width ); ?></td>
								<td><?php echo esc_html( $height ); ?></td>
								<td><?php echo esc_html( $markers_count ); ?></td>
								<td><code>[eo_map id="<?php echo esc_attr( $map['id'] ); ?>"]</code></td>
								<td class="eo-maps-actions-cell">
									<a href="?page=eo-blocks-maps&action=edit&map_id=<?php echo esc_attr( $map['id'] ); ?>" class="button button-small"><?php esc_html_e( 'Modifier', 'eo-blocks' ); ?></a>
									<button type="button" class="button button-link-delete eo-delete-map-btn" data-id="<?php echo esc_attr( $map['id'] ); ?>"><?php esc_html_e( 'Supprimer', 'eo-blocks' ); ?></button>
								</td>
							</tr>
						<?php endforeach; ?>
					<?php endif; ?>
				</tbody>
			</table>
		</div>

	<?php elseif ( 'edit' === $action ) : ?>
		<a href="?page=eo-blocks-maps" class="page-title-action"><?php esc_html_e( 'Retour à la liste', 'eo-blocks' ); ?></a>
		<hr class="wp-header-end">

		<div class="eo-maps-editor-container" style="display: flex; margin-top: 20px; background: #fff; border: 1px solid #ccd0d4; box-shadow: 0 1px 1px rgba(0,0,0,.04);">
			
			<!-- Sidebar d'édition -->
			<div class="eo-maps-editor-sidebar" style="width: 380px; border-right: 1px solid #ccd0d4; display: flex; flex-direction: column;">
				
				<!-- Titre de la carte -->
				<div style="padding: 15px; border-bottom: 1px solid #ccd0d4; background: #f8f9fa;">
					<label for="eo-map-title-input" style="font-weight: bold; display: block; margin-bottom: 5px;"><?php esc_html_e( 'Titre de la carte', 'eo-blocks' ); ?></label>
					<input type="text" id="eo-map-title-input" value="<?php echo esc_attr( $map_to_edit['title'] ?? __( 'Ma première carte', 'eo-blocks' ) ); ?>" style="width: 100%; font-size: 16px; padding: 6px 10px;" />
				</div>

				<!-- Onglets -->
				<div class="eo-maps-tabs" style="display: flex; border-bottom: 1px solid #ccd0d4; background: #f1f1f1;">
					<button type="button" class="eo-maps-tab-link active" data-tab="tab-settings" style="flex: 1; padding: 12px; border: none; background: none; font-weight: bold; cursor: pointer; border-bottom: 2px solid transparent;"><?php esc_html_e( 'Paramètres', 'eo-blocks' ); ?></button>
					<button type="button" class="eo-maps-tab-link" data-tab="tab-markers" style="flex: 1; padding: 12px; border: none; background: none; font-weight: bold; cursor: pointer; border-bottom: 2px solid transparent;"><?php esc_html_e( 'Marqueurs', 'eo-blocks' ); ?></button>
				</div>

				<!-- Onglet Paramètres -->
				<div id="tab-settings" class="eo-maps-tab-content active" style="padding: 15px; overflow-y: auto; flex: 1;">
					
					<div class="eo-map-form-group" style="margin-bottom: 15px;">
						<label for="eo-map-width" style="font-weight: bold; display: block; margin-bottom: 5px;"><?php esc_html_e( 'Largeur de la carte', 'eo-blocks' ); ?></label>
						<input type="text" id="eo-map-width" value="<?php echo esc_attr( $map_to_edit['settings']['width'] ?? '100%' ); ?>" style="width: 100%;" placeholder="ex: 100%, 800px" />
					</div>

					<div class="eo-map-form-group" style="margin-bottom: 15px;">
						<label for="eo-map-height" style="font-weight: bold; display: block; margin-bottom: 5px;"><?php esc_html_e( 'Hauteur de la carte', 'eo-blocks' ); ?></label>
						<input type="text" id="eo-map-height" value="<?php echo esc_attr( $map_to_edit['settings']['height'] ?? '600px' ); ?>" style="width: 100%;" placeholder="ex: 600px, 450px" />
					</div>

					<div class="eo-map-form-group" style="margin-bottom: 15px;">
						<label for="eo-map-style" style="font-weight: bold; display: block; margin-bottom: 5px;"><?php esc_html_e( 'Style de fond de carte', 'eo-blocks' ); ?></label>
						<select id="eo-map-style" style="width: 100%;">
							<option value="osm" <?php selected( $map_to_edit['settings']['tileStyle'] ?? 'osm', 'osm' ); ?>><?php esc_html_e( 'Standard OpenStreetMap', 'eo-blocks' ); ?></option>
							<option value="carto-light" <?php selected( $map_to_edit['settings']['tileStyle'] ?? 'osm', 'carto-light' ); ?>><?php esc_html_e( 'CartoDB Positron (Clair)', 'eo-blocks' ); ?></option>
							<option value="carto-dark" <?php selected( $map_to_edit['settings']['tileStyle'] ?? 'osm', 'carto-dark' ); ?>><?php esc_html_e( 'CartoDB Dark Matter (Sombre)', 'eo-blocks' ); ?></option>
							<option value="opentopo" <?php selected( $map_to_edit['settings']['tileStyle'] ?? 'osm', 'opentopo' ); ?>><?php esc_html_e( 'OpenTopoMap (Relief)', 'eo-blocks' ); ?></option>
							<option value="openfreemap" <?php selected( $map_to_edit['settings']['tileStyle'] ?? 'osm', 'openfreemap' ); ?>><?php esc_html_e( 'OpenFreeMap (multilingue)', 'eo-blocks' ); ?></option>
						</select>
					</div>

					<div class="eo-map-form-group" id="eo-map-design-group" style="margin-bottom: 15px; display: none;">
						<label for="eo-map-design" style="font-weight: bold; display: block; margin-bottom: 5px;"><?php esc_html_e( 'Design de la carte', 'eo-blocks' ); ?></label>
						<select id="eo-map-design" style="width: 100%;">
							<option value="positron" <?php selected( $map_to_edit['settings']['mapDesign'] ?? 'positron', 'positron' ); ?>><?php esc_html_e( 'Positron (Clair, épuré)', 'eo-blocks' ); ?></option>
							<option value="liberty" <?php selected( $map_to_edit['settings']['mapDesign'] ?? 'positron', 'liberty' ); ?>><?php esc_html_e( 'Liberty (Détaillé, coloré)', 'eo-blocks' ); ?></option>
							<option value="bright" <?php selected( $map_to_edit['settings']['mapDesign'] ?? 'positron', 'bright' ); ?>><?php esc_html_e( 'Bright (Vif, contrasté)', 'eo-blocks' ); ?></option>
							<option value="dark" <?php selected( $map_to_edit['settings']['mapDesign'] ?? 'positron', 'dark' ); ?>><?php esc_html_e( 'Dark (Sombre, épuré)', 'eo-blocks' ); ?></option>
						</select>
						<p class="description" style="font-size: 11px; margin: 4px 0 0 0; color: #666;">
							<?php esc_html_e( 'Uniquement disponible avec le fond de carte OpenFreeMap.', 'eo-blocks' ); ?>
						</p>
					</div>

					<div class="eo-map-form-group" id="eo-map-language-group" style="margin-bottom: 15px; display: none;">
						<label for="eo-map-language" style="font-weight: bold; display: block; margin-bottom: 5px;"><?php esc_html_e( 'Langue des noms de lieux', 'eo-blocks' ); ?></label>
						<select id="eo-map-language" style="width: 100%;">
							<option value="local" <?php selected( $map_to_edit['settings']['mapLanguage'] ?? 'local', 'local' ); ?>><?php esc_html_e( 'Langue d\'origine (par pays)', 'eo-blocks' ); ?></option>
							<option value="fr" <?php selected( $map_to_edit['settings']['mapLanguage'] ?? 'local', 'fr' ); ?>><?php esc_html_e( 'Tout en français', 'eo-blocks' ); ?></option>
							<option value="en" <?php selected( $map_to_edit['settings']['mapLanguage'] ?? 'local', 'en' ); ?>><?php esc_html_e( 'Tout en anglais', 'eo-blocks' ); ?></option>
						</select>
						<p class="description" style="font-size: 11px; margin: 4px 0 0 0; color: #666;">
							<?php esc_html_e( 'Uniquement disponible avec le fond de carte OpenFreeMap.', 'eo-blocks' ); ?>
						</p>
					</div>

					<?php
						// Zoom range supported by each basemap provider (kept in sync with the
						// PROVIDER_ZOOM_LIMITS map in assets/js/maps-admin.js).
						$zoom_bounds_by_style = array(
							'osm'          => array( 0, 19 ),
							'carto-light'  => array( 0, 19 ),
							'carto-dark'   => array( 0, 19 ),
							'opentopo'     => array( 0, 19 ),
							'openfreemap'  => array( 0, 20 ),
						);
						$current_tile_style = $map_to_edit['settings']['tileStyle'] ?? 'osm';
						list( $style_min_zoom, $style_max_zoom ) = $zoom_bounds_by_style[ $current_tile_style ] ?? array( 0, 19 );

						$current_zoom = intval( $map_to_edit['settings']['zoom'] ?? 12 );
						$min_zoom_val = intval( $map_to_edit['settings']['minZoom'] ?? $style_min_zoom );
						$max_zoom_val = intval( $map_to_edit['settings']['maxZoom'] ?? $style_max_zoom );

						// Keep the stored bounds coherent with the current zoom level and the
						// provider's own limits before first render (JS re-checks this on load too).
						$min_zoom_val = max( $style_min_zoom, min( $min_zoom_val, $current_zoom ) );
						$max_zoom_val = min( $style_max_zoom, max( $max_zoom_val, $current_zoom ) );
					?>
					<div style="background: #f8f9fa; border: 1px solid #ccd0d4; padding: 12px; border-radius: 4px;">
						<h4 style="margin-top: 0; margin-bottom: 8px; font-weight: bold;"><?php esc_html_e( 'Vue par défaut', 'eo-blocks' ); ?></h4>
						<p style="font-size: 11px; margin: 0 0 10px 0; color: #666;"><?php esc_html_e( 'Ces coordonnées sont synchronisées automatiquement lorsque vous zoomez ou déplacez la carte.', 'eo-blocks' ); ?></p>
						<div style="display: flex; gap: 10px; margin-bottom: 8px;">
							<div style="flex: 1;">
								<span style="font-size: 11px; color: #666;"><?php esc_html_e( 'Latitude', 'eo-blocks' ); ?></span>
								<input type="text" id="eo-map-center-lat" value="<?php echo esc_attr( $map_to_edit['settings']['centerLat'] ?? '43.6107' ); ?>" readonly style="width: 100%; font-size: 11px; background: #eee;" />
							</div>
							<div style="flex: 1;">
								<span style="font-size: 11px; color: #666;"><?php esc_html_e( 'Longitude', 'eo-blocks' ); ?></span>
								<input type="text" id="eo-map-center-lng" value="<?php echo esc_attr( $map_to_edit['settings']['centerLng'] ?? '3.8767' ); ?>" readonly style="width: 100%; font-size: 11px; background: #eee;" />
							</div>
						</div>
						<div style="margin-bottom: 8px;">
							<span style="font-size: 11px; color: #666;"><?php esc_html_e( 'Niveau de Zoom', 'eo-blocks' ); ?></span>
							<input type="text" id="eo-map-zoom" value="<?php echo esc_attr( $current_zoom ); ?>" readonly style="width: 100%; font-size: 11px; background: #eee;" />
						</div>
						<div style="display: flex; gap: 10px;">
							<div style="flex: 1;">
								<span style="font-size: 11px; color: #666;"><?php esc_html_e( 'Zoom minimal', 'eo-blocks' ); ?> (<span id="eo-map-min-zoom-value"><?php echo esc_html( $min_zoom_val ); ?></span>)</span>
								<input type="range" id="eo-map-min-zoom" min="<?php echo esc_attr( $style_min_zoom ); ?>" max="<?php echo esc_attr( $style_max_zoom ); ?>" step="1" value="<?php echo esc_attr( $min_zoom_val ); ?>" style="width: 100%;" />
							</div>
							<div style="flex: 1;">
								<span style="font-size: 11px; color: #666;"><?php esc_html_e( 'Zoom maximal', 'eo-blocks' ); ?> (<span id="eo-map-max-zoom-value"><?php echo esc_html( $max_zoom_val ); ?></span>)</span>
								<input type="range" id="eo-map-max-zoom" min="<?php echo esc_attr( $style_min_zoom ); ?>" max="<?php echo esc_attr( $style_max_zoom ); ?>" step="1" value="<?php echo esc_attr( $max_zoom_val ); ?>" style="width: 100%;" />
							</div>
						</div>
					</div>

				</div>

				<!-- Onglet Marqueurs -->
				<div id="tab-markers" class="eo-maps-tab-content" style="padding: 15px; overflow-y: auto; flex: 1; display: none;">
					
					<!-- Liste des marqueurs existants -->
					<div id="eo-markers-list-section">
						<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
							<h3 style="margin: 0; font-size: 14px; font-weight: bold;"><?php esc_html_e( 'Mes Marqueurs', 'eo-blocks' ); ?></h3>
							<button type="button" id="eo-add-marker-trigger" class="button button-secondary"><?php esc_html_e( 'Ajouter un marqueur', 'eo-blocks' ); ?></button>
						</div>

						<div id="eo-markers-list-container" style="display: flex; flex-direction: column; gap: 8px;">
							<!-- Injecté dynamiquement par JS -->
						</div>
					</div>

					<!-- Formulaire de Marqueur (Ajout/Edition) -->
					<div id="eo-marker-form-section" style="display: none; border: 1px solid #ccd0d4; padding: 12px; border-radius: 4px; background: #f8f9fa;">
						<h3 id="eo-marker-form-title" style="margin-top: 0; font-size: 14px; font-weight: bold; border-bottom: 1px solid #ccd0d4; padding-bottom: 8px;">
							<?php esc_html_e( 'Créer un marqueur', 'eo-blocks' ); ?>
						</h3>

						<input type="hidden" id="eo-marker-form-id" value="" />

						<!-- Recherche d'adresse textuelle (Géocodage) -->
						<div class="eo-map-form-group" style="margin-bottom: 12px;">
							<label style="font-weight: bold; display: block; margin-bottom: 5px;"><?php esc_html_e( 'Adresse / GPS', 'eo-blocks' ); ?></label>
							<div style="display: flex; gap: 6px;">
								<input type="text" id="eo-marker-address-search" style="flex: 1;" placeholder="<?php esc_attr_e( 'Rechercher une adresse...', 'eo-blocks' ); ?>" />
								<button type="button" id="eo-marker-address-search-btn" class="button"><?php esc_html_e( 'Rechercher', 'eo-blocks' ); ?></button>
							</div>
						</div>

						<div style="display: flex; gap: 10px; margin-bottom: 12px;">
							<div style="flex: 1;">
								<span style="font-size: 11px; color: #666;"><?php esc_html_e( 'Latitude', 'eo-blocks' ); ?></span>
								<input type="text" id="eo-marker-lat" style="width: 100%; font-size: 11px;" placeholder="0.0" />
							</div>
							<div style="flex: 1;">
								<span style="font-size: 11px; color: #666;"><?php esc_html_e( 'Longitude', 'eo-blocks' ); ?></span>
								<input type="text" id="eo-marker-lng" style="width: 100%; font-size: 11px;" placeholder="0.0" />
							</div>
						</div>

						<div class="eo-map-form-group" style="margin-bottom: 12px;">
							<label for="eo-marker-title" style="font-weight: bold; display: block; margin-bottom: 5px;"><?php esc_html_e( 'Titre du marqueur', 'eo-blocks' ); ?></label>
							<input type="text" id="eo-marker-title" style="width: 100%;" placeholder="<?php esc_attr_e( 'Titre du lieu', 'eo-blocks' ); ?>" />
						</div>

						<div class="eo-map-form-group" style="margin-bottom: 12px;">
							<label for="eo-marker-description" style="font-weight: bold; display: block; margin-bottom: 5px;"><?php esc_html_e( 'Description', 'eo-blocks' ); ?></label>
							<textarea id="eo-marker-description" style="width: 100%; height: 60px;" placeholder="<?php esc_attr_e( 'Description courte...', 'eo-blocks' ); ?>"></textarea>
							<p class="description" style="font-size: 11px; margin: 4px 0 0 0; color: #666; line-height: 1.3;">
								<?php esc_html_e( 'Supporte les retours à la ligne et le Markdown de base : # pour les titres, **gras**, *italique*, listes avec - ou *.', 'eo-blocks' ); ?>
							</p>
						</div>

						<div class="eo-map-form-group" style="margin-bottom: 12px;">
							<label for="eo-marker-url" style="font-weight: bold; display: block; margin-bottom: 5px;"><?php esc_html_e( 'Lien URL', 'eo-blocks' ); ?></label>
							<input type="url" id="eo-marker-url" style="width: 100%;" placeholder="https://..." />
						</div>

						<div class="eo-map-form-group" style="margin-bottom: 12px;">
							<label for="eo-marker-link-label" style="font-weight: bold; display: block; margin-bottom: 5px;"><?php esc_html_e( 'Texte du lien', 'eo-blocks' ); ?></label>
							<input type="text" id="eo-marker-link-label" style="width: 100%;" placeholder="<?php esc_attr_e( 'Visiter le lien →', 'eo-blocks' ); ?>" />
						</div>

						<div class="eo-map-form-group" style="margin-bottom: 12px;">
							<label for="eo-marker-phone" style="font-weight: bold; display: block; margin-bottom: 5px;"><?php esc_html_e( 'Numéro de téléphone', 'eo-blocks' ); ?></label>
							<input type="tel" id="eo-marker-phone" style="width: 100%;" placeholder="+33..." />
						</div>

						<div class="eo-map-form-group" style="margin-bottom: 12px;">
							<label for="eo-marker-category" style="font-weight: bold; display: block; margin-bottom: 5px;"><?php esc_html_e( 'Catégorie', 'eo-blocks' ); ?></label>
							<input type="text" id="eo-marker-category" style="width: 100%;" placeholder="<?php esc_attr_e( 'ex: Hôtel, Monument', 'eo-blocks' ); ?>" />
						</div>

						<!-- Type de marqueur -->
						<div class="eo-map-form-group" style="margin-bottom: 12px;">
							<label for="eo-marker-type" style="font-weight: bold; display: block; margin-bottom: 5px;"><?php esc_html_e( 'Type de marqueur', 'eo-blocks' ); ?></label>
							<select id="eo-marker-type" style="width: 100%;">
								<option value="default"><?php esc_html_e( 'Par défaut / Image personnalisée', 'eo-blocks' ); ?></option>
								<option value="svg_pin"><?php esc_html_e( 'Épingle vectorielle SVG', 'eo-blocks' ); ?></option>
								<option value="svg_circle"><?php esc_html_e( 'Cercle vectoriel SVG', 'eo-blocks' ); ?></option>
							</select>
						</div>

						<!-- Couleur du marqueur (conditionnel) -->
						<div class="eo-map-form-group" id="eo-marker-color-group" style="margin-bottom: 12px; display: none;">
							<label for="eo-marker-color" style="font-weight: bold; display: block; margin-bottom: 5px;"><?php esc_html_e( 'Couleur du marqueur', 'eo-blocks' ); ?></label>
							<div style="display: flex; align-items: center; gap: 8px;">
								<input type="color" id="eo-marker-color" value="#0066FF" style="width: 50px; height: 30px; padding: 0; border: 1px solid #ccd0d4; border-radius: 4px; cursor: pointer;" />
								<span id="eo-marker-color-value" style="font-family: monospace; font-size: 13px; color: #555;">#0066FF</span>
							</div>
						</div>

						<!-- Animation du marqueur -->
						<div class="eo-map-form-group" style="margin-bottom: 12px;">
							<label for="eo-marker-animation" style="font-weight: bold; display: block; margin-bottom: 5px;"><?php esc_html_e( 'Animation', 'eo-blocks' ); ?></label>
							<select id="eo-marker-animation" style="width: 100%;">
								<option value="bounce"><?php esc_html_e( 'Rebond (À l\'entrée)', 'eo-blocks' ); ?></option>
								<option value="pulse"><?php esc_html_e( 'Clignotement (Continu)', 'eo-blocks' ); ?></option>
								<option value="float"><?php esc_html_e( 'Flottement (Continu)', 'eo-blocks' ); ?></option>
								<option value="none"><?php esc_html_e( 'Aucune', 'eo-blocks' ); ?></option>
							</select>
						</div>

						<!-- Icône personnalisée -->
						<div class="eo-map-form-group" id="eo-marker-custom-icon-group" style="margin-bottom: 12px;">
							<label style="font-weight: bold; display: block; margin-bottom: 5px;"><?php esc_html_e( 'Icône de marqueur', 'eo-blocks' ); ?></label>
							<div style="display: flex; align-items: center; gap: 10px;">
								<div id="eo-marker-icon-preview" style="width: 32px; height: 32px; border: 1px dashed #ccc; display: flex; align-items: center; justify-content: center; background: #fff;">
									<!-- Preview icône -->
								</div>
								<input type="hidden" id="eo-marker-icon-url" value="" />
								<button type="button" id="eo-marker-icon-select-btn" class="button"><?php esc_html_e( 'Sélectionner', 'eo-blocks' ); ?></button>
								<button type="button" id="eo-marker-icon-reset-btn" class="button button-link-delete" style="padding: 0;"><?php esc_html_e( 'Reset', 'eo-blocks' ); ?></button>
							</div>
						</div>

						<!-- Galerie photos -->
						<div class="eo-map-form-group" style="margin-bottom: 15px;">
							<label style="font-weight: bold; display: block; margin-bottom: 5px;"><?php esc_html_e( 'Galerie photo', 'eo-blocks' ); ?></label>
							<button type="button" id="eo-marker-gallery-select-btn" class="button" style="margin-bottom: 8px;"><?php esc_html_e( 'Gérer la galerie', 'eo-blocks' ); ?></button>
							<div id="eo-marker-gallery-preview" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;">
								<!-- Grid d'images sélectionnées -->
							</div>
						</div>

						<div style="display: flex; gap: 8px; border-top: 1px solid #ccd0d4; padding-top: 10px; margin-top: 10px;">
							<button type="button" id="eo-save-marker-btn" class="button button-primary" style="flex: 1;"><?php esc_html_e( 'Enregistrer le marqueur', 'eo-blocks' ); ?></button>
							<button type="button" id="eo-cancel-marker-btn" class="button" style="flex: 1;"><?php esc_html_e( 'Annuler', 'eo-blocks' ); ?></button>
						</div>
					</div>

				</div>

				<!-- Bouton d'enregistrement global (toujours visible) -->
				<div style="padding: 15px; border-top: 1px solid #ccd0d4; background: #f8f9fa; margin-top: auto;">
					<button type="button" id="eo-save-map-btn" class="button button-primary button-large" style="width: 100%; font-size: 14px; padding: 8px 12px; height: auto; font-weight: bold;"><?php esc_html_e( 'Enregistrer la carte', 'eo-blocks' ); ?></button>
				</div>

			</div>

			<!-- Zone de la Carte -->
			<div class="eo-maps-editor-map-container" style="flex: 1; position: relative;">
				<div id="eo-maps-leaflet-admin" style="width: 100%; height: 600px; background: #e5e3df;"></div>
				<div style="position: absolute; bottom: 10px; left: 10px; z-index: 1000; background: rgba(255,255,255,0.9); padding: 5px 10px; border-radius: 4px; box-shadow: 0 1px 5px rgba(0,0,0,0.4); font-size: 11px;">
					<?php esc_html_e( 'Clic gauche sur la carte pour créer un marqueur.', 'eo-blocks' ); ?>
				</div>
			</div>

		</div>

		<!-- Variables JSON pour JS -->
		<script type="text/javascript">
			window.eoMapData = <?php echo json_encode( $map_to_edit ); ?>;
		</script>
	<?php endif; ?>
</div>
