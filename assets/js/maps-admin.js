jQuery(document).ready(function($) {

    // Helper: Escape HTML
    function escapeHtml(string) {
        var entityMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
            '/': '&#x2F;',
            '`': '&#x60;',
            '=': '&#x3D;'
        };
        return String(string).replace(/[&<>"'`=\/]/g, function(s) {
            return entityMap[s];
        });
    }

    // Helper: Format marker description supporting line breaks & basic markdown
    function formatMarkerDescription(desc) {
        if (!desc) return '';
        var html = desc;

        // Support headers: ### text -> <h6>text</h6>, ## text -> <h5>text</h5>, # text -> <h4>text</h4>
        html = html.replace(/^### (.*?)$/gm, '<h6>$1</h6>');
        html = html.replace(/^## (.*?)$/gm, '<h5>$1</h5>');
        html = html.replace(/^# (.*?)$/gm, '<h4>$1</h4>');

        // Support bold: **text** -> <strong>text</strong>
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // Support simple bullet lists:
        var lines = html.split('\n');
        var inList = false;
        var processedLines = [];

        lines.forEach(function(line) {
            var trimmed = line.trim();
            if (trimmed.indexOf('- ') === 0 || trimmed.indexOf('* ') === 0) {
                if (!inList) {
                    processedLines.push('<ul>');
                    inList = true;
                }
                var itemContent = trimmed.substring(2);
                processedLines.push('<li>' + itemContent + '</li>');
            } else {
                if (inList) {
                    processedLines.push('</ul>');
                    inList = false;
                }
                processedLines.push(line);
            }
        });
        if (inList) {
            processedLines.push('</ul>');
        }

        html = processedLines.join('\n');

        // Replace remaining newlines with <br>
        html = html.replace(/\r?\n/g, '<br>');
        
        // Cleanup double spacings
        html = html.replace(/<br>\s*<ul>/g, '<ul>');
        html = html.replace(/<\/ul>\s*<br>/g, '</ul>');
        html = html.replace(/<ul>\s*<br>/g, '<ul>');
        html = html.replace(/<\/li>\s*<br>/g, '</li>');
        html = html.replace(/<li>\s*<br>/g, '<li>');
        html = html.replace(/<br>\s*<h4>/g, '<h4>');
        html = html.replace(/<\/h4>\s*<br>/g, '</h4>');
        html = html.replace(/<br>\s*<h5>/g, '<h5>');
        html = html.replace(/<\/h5>\s*<br>/g, '</h5>');
        html = html.replace(/<br>\s*<h6>/g, '<h6>');
        html = html.replace(/<\/h6>\s*<br>/g, '</h6>');

        return html;
    }

    // ==========================================
    // STATE 1: MAP LIST PAGE
    // ==========================================
    $('.eo-delete-map-btn').on('click', function(e) {
        e.preventDefault();
        var mapId = $(this).data('id');
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette carte ? Cette action est irréversible.')) {
            return;
        }

        var $btn = $(this);
        $btn.text('Suppression...').prop('disabled', true);

        $.post(eoMapsAdmin.ajaxUrl, {
            action: 'eo_maps_delete_map',
            map_id: mapId,
            nonce: eoMapsAdmin.nonce
        }, function(response) {
            if (response.success) {
                $btn.closest('tr').fadeOut(function() {
                    $(this).remove();
                    if ($('table.posts tbody tr').length === 0) {
                        location.reload();
                    }
                });
            } else {
                alert(response.data.message || 'Une erreur est survenue.');
                $btn.text('Supprimer').prop('disabled', false);
            }
        }).fail(function() {
            alert('Une erreur serveur est survenue.');
            $btn.text('Supprimer').prop('disabled', false);
        });
    });

    // ==========================================
    // STATE 2: MAP EDITOR PAGE
    // ==========================================
    if (typeof window.eoMapData === 'undefined' || window.eoMapData === null) {
        return; // Not on the editor page
    }

    var mapId = parseInt(window.eoMapData.id) || 0;
    var mapSettings = window.eoMapData.settings || {};
    var markersList = window.eoMapData.markers || [];

    // Zoom range supported by each basemap provider (kept in sync with the
    // $zoom_bounds_by_style map in includes/admin/views/html-admin-page-maps.php).
    var PROVIDER_ZOOM_LIMITS = {
        'osm': { min: 0, max: 19 },
        'carto-light': { min: 0, max: 19 },
        'carto-dark': { min: 0, max: 19 },
        'opentopo': { min: 0, max: 19 },
        'openfreemap': { min: 0, max: 20 }
    };

    function getProviderZoomLimits(styleKey) {
        return PROVIDER_ZOOM_LIMITS[styleKey] || PROVIDER_ZOOM_LIMITS['osm'];
    }
    
    var leafletMap = null;
    var currentTileLayer = null;
    var leafletMarkersMap = {}; // id -> L.marker
    var currentGallery = []; // Holds URLs of current editing marker gallery

    // Save button state manager
    function setSaveButtonState(state) {
        var $btn = $('#eo-save-map-btn');
        if (state === 'active') {
            $btn.text('Enregistrer la carte')
                .css({
                    'background-color': '#2271b1',
                    'border-color': '#2271b1',
                    'color': '#fff',
                    'cursor': 'pointer'
                })
                .prop('disabled', false);
        } else if (state === 'saving') {
            $btn.text('Enregistrement en cours...')
                .css({
                    'background-color': '#46b450',
                    'border-color': '#46b450',
                    'color': '#fff',
                    'cursor': 'not-allowed'
                })
                .prop('disabled', true);
        } else if (state === 'saved') {
            $btn.text('Carte enregistrée √')
                .css({
                    'background-color': '#c3c4c7',
                    'border-color': '#c3c4c7',
                    'color': '#787c82',
                    'cursor': 'not-allowed'
                })
                .prop('disabled', true);
        }
    }

    var hasUnsavedChanges = false;

    function markChangesAsUnsaved() {
        hasUnsavedChanges = true;
        setSaveButtonState('active');
    }

    // Save map logic (AJAX helper)
    function saveMap(onSuccess) {
        var title = $('#eo-map-title-input').val().trim();
        if (!title) {
            title = 'Ma carte';
            $('#eo-map-title-input').val(title);
        }

        var settings = {
            width: $('#eo-map-width').val().trim() || '100%',
            height: $('#eo-map-height').val().trim() || '600px',
            zoom: parseInt($('#eo-map-zoom').val()) || 12,
            minZoom: parseInt($('#eo-map-min-zoom').val()) || 0,
            maxZoom: parseInt($('#eo-map-max-zoom').val()) || 19,
            centerLat: parseFloat($('#eo-map-center-lat').val()) || 43.6107,
            centerLng: parseFloat($('#eo-map-center-lng').val()) || 3.8767,
            tileStyle: $('#eo-map-style').val() || 'osm',
            mapLanguage: $('#eo-map-language').val() || 'local',
            mapDesign: $('#eo-map-design').val() || 'positron'
        };

        setSaveButtonState('saving');

        $.post(eoMapsAdmin.ajaxUrl, {
            action: 'eo_maps_save_map',
            map_id: mapId,
            title: title,
            settings: JSON.stringify(settings),
            markers: JSON.stringify(markersList),
            nonce: eoMapsAdmin.nonce
        }, function(response) {
            if (response.success) {
                hasUnsavedChanges = false; // Reset unsaved changes flag
                if (mapId === 0) {
                    window.location.href = '?page=eo-blocks-maps&action=edit&map_id=' + response.data.map_id;
                } else {
                    setSaveButtonState('saved');
                    if (typeof onSuccess === 'function') {
                        onSuccess();
                    }
                }
            } else {
                alert(response.data.message || 'Une erreur est survenue lors de la sauvegarde.');
                setSaveButtonState('active');
            }
        }).fail(function() {
            alert('Une erreur réseau est survenue.');
            setSaveButtonState('active');
        });
    }

    // Prevent leaving with unsaved changes
    $(window).on('beforeunload', function(e) {
        if (hasUnsavedChanges) {
            var message = 'Vous avez des modifications non enregistrées. Voulez-vous vraiment quitter cette page ?';
            e.returnValue = message;
            return message;
        }
    });

    // Create custom marker icon according to its type, color and animation
    function createMarkerIcon(markerData) {
        var markerType = markerData.marker_type || 'default';
        var color = markerData.color || '#0066FF';
        var animation = markerData.animation || 'bounce';
        
        // Build animation class
        var animClass = '';
        if (animation === 'bounce') {
            animClass = 'eo-marker-bounce-animation';
        } else if (animation === 'pulse') {
            animClass = 'eo-marker-pulse-animation';
        } else if (animation === 'float') {
            animClass = 'eo-marker-float-animation';
        }
        
        if (markerType === 'svg_pin') {
            var svgHtml = '<svg viewBox="0 0 24 30" width="30" height="38" xmlns="http://www.w3.org/2000/svg" style="display: block; filter: drop-shadow(0px 3px 4px rgba(0,0,0,0.3));">' +
                '<path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 18 12 18s12-9 12-18c0-6.63-5.37-12-12-12zm0 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" fill="' + escapeHtml(color) + '" stroke="#ffffff" stroke-width="1.5"/>' +
                '</svg>';
            return L.divIcon({
                html: svgHtml,
                iconSize: [30, 38],
                iconAnchor: [15, 38],
                popupAnchor: [0, -38],
                className: 'eo-map-custom-svg-icon ' + animClass,
                bgPos: [0, 0]
            });
        } else if (markerType === 'svg_circle') {
            var svgHtml = '<svg viewBox="0 0 30 30" width="30" height="30" xmlns="http://www.w3.org/2000/svg" style="display: block; filter: drop-shadow(0px 3px 4px rgba(0,0,0,0.3));">' +
                '<circle cx="15" cy="15" r="11" fill="' + escapeHtml(color) + '" stroke="#ffffff" stroke-width="2.5"/>' +
                '</svg>';
            return L.divIcon({
                html: svgHtml,
                iconSize: [30, 30],
                iconAnchor: [15, 15],
                popupAnchor: [0, -15],
                className: 'eo-map-custom-svg-icon ' + animClass,
                bgPos: [0, 0]
            });
        } else {
            // Default image marker
            var iconUrl = markerData.icon || 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
            var shadowUrl = markerData.icon ? '' : 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';
            var iconSize = markerData.icon ? [32, 32] : [25, 41];
            var iconAnchor = markerData.icon ? [16, 32] : [12, 41];
            var popupAnchor = markerData.icon ? [0, -32] : [1, -34];
            
            return L.icon({
                iconUrl: iconUrl,
                shadowUrl: shadowUrl,
                iconSize: iconSize,
                iconAnchor: iconAnchor,
                popupAnchor: popupAnchor,
                className: animClass
            });
        }
    }

    var defaultIcon = createMarkerIcon({ marker_type: 'default' });

    // 1. Initialize Tabs
    $('.eo-maps-tab-link').on('click', function() {
        $('.eo-maps-tab-link').removeClass('active');
        $(this).addClass('active');

        var targetTab = $(this).data('tab');
        $('.eo-maps-tab-content').removeClass('active').hide();
        $('#' + targetTab).addClass('active').show();
    });

    // 2. Initialize Leaflet Map
    var centerLat = parseFloat(mapSettings.centerLat) || 43.6107;
    var centerLng = parseFloat(mapSettings.centerLng) || 3.8767;
    var zoomLevel = parseInt(mapSettings.zoom) || 12;

    leafletMap = L.map('eo-maps-leaflet-admin').setView([centerLat, centerLng], zoomLevel);

    // Map style provider layers
    var tileProviders = {
        'osm': 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        'carto-light': 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        'carto-dark': 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        'opentopo': 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
    };

    // Rewrites the "text-field" of every MapLibre style layer that shows a place/country
    // name so it displays in the requested language, falling back to the local (original)
    // name when no translation exists. Does nothing for lang === 'local'.
    function applyMapLanguage(maplibreMap, lang) {
        if (!lang || lang === 'local') {
            return;
        }

        var setLabelLanguage = function() {
            var style = maplibreMap.getStyle();
            if (!style || !Array.isArray(style.layers)) {
                return;
            }
            style.layers.forEach(function(layer) {
                var textField = layer.layout && layer.layout['text-field'];
                if (!textField) {
                    return;
                }
                maplibreMap.setLayoutProperty(layer.id, 'text-field', [
                    'coalesce',
                    ['get', 'name:' + lang],
                    ['get', 'name']
                ]);
            });
        };

        if (maplibreMap.isStyleLoaded()) {
            setLabelLanguage();
        } else {
            maplibreMap.once('load', setLabelLanguage);
        }
    }

    // OpenFreeMap design variants (all open-source, no API key, all support language switching).
    var openFreeMapDesigns = ['positron', 'liberty', 'bright', 'dark'];

    function setTileLayer(styleKey, lang, design) {
        if (currentTileLayer) {
            leafletMap.removeLayer(currentTileLayer);
            currentTileLayer = null;
        }

        if (styleKey === 'openfreemap') {
            if (typeof L.maplibreGL !== 'function') {
                return;
            }
            var designKey = openFreeMapDesigns.indexOf(design) !== -1 ? design : 'positron';
            currentTileLayer = L.maplibreGL({
                style: 'https://tiles.openfreemap.org/styles/' + designKey,
                attribution: '© OpenStreetMap contributors © OpenFreeMap'
            }).addTo(leafletMap);
            applyMapLanguage(currentTileLayer.getMaplibreMap(), lang);
            return;
        }

        var url = tileProviders[styleKey] || tileProviders['osm'];
        var attrib = '© OpenStreetMap contributors';
        if (styleKey.indexOf('carto') !== -1) {
            attrib = '© OpenStreetMap contributors, © CartoDB';
        } else if (styleKey === 'opentopo') {
            attrib = '© OpenTopoMap contributors';
        }
        currentTileLayer = L.tileLayer(url, {
            maxZoom: 19,
            attribution: attrib
        }).addTo(leafletMap);
    }

    // Shows the design & language selectors only when the OpenFreeMap basemap is selected.
    function toggleOpenFreeMapFields(styleKey) {
        var isOpenFreeMap = styleKey === 'openfreemap';
        $('#eo-map-design-group').toggle(isOpenFreeMap);
        $('#eo-map-language-group').toggle(isOpenFreeMap);
    }

    function currentOpenFreeMapSettings() {
        return {
            lang: $('#eo-map-language').val(),
            design: $('#eo-map-design').val()
        };
    }

    setTileLayer(mapSettings.tileStyle || 'osm', mapSettings.mapLanguage || 'local', mapSettings.mapDesign || 'positron');
    toggleOpenFreeMapFields(mapSettings.tileStyle || 'osm');
    $('#eo-map-language').val(mapSettings.mapLanguage || 'local');
    $('#eo-map-design').val(mapSettings.mapDesign || 'positron');

    function clampNumber(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    // Applies the current basemap provider's zoom range to the min/max zoom
    // sliders, keeps min <= max, and syncs those bounds onto the Leaflet map
    // (which will itself pull the current view's zoom back into range).
    function applyZoomProviderLimits(styleKey) {
        var limits = getProviderZoomLimits(styleKey);

        $('#eo-map-min-zoom').attr({ min: limits.min, max: limits.max });
        $('#eo-map-max-zoom').attr({ min: limits.min, max: limits.max });

        var minVal = clampNumber(parseInt($('#eo-map-min-zoom').val(), 10) || limits.min, limits.min, limits.max);
        var maxVal = clampNumber(parseInt($('#eo-map-max-zoom').val(), 10) || limits.max, limits.min, limits.max);

        if (minVal > maxVal) {
            maxVal = minVal;
        }

        $('#eo-map-min-zoom').val(minVal);
        $('#eo-map-max-zoom').val(maxVal);
        $('#eo-map-min-zoom-value').text(minVal);
        $('#eo-map-max-zoom-value').text(maxVal);

        leafletMap.setMinZoom(minVal);
        leafletMap.setMaxZoom(maxVal);
    }

    applyZoomProviderLimits(mapSettings.tileStyle || 'osm');

    // Zoom minimal slider: never allow it to go above the current zoom maximal value.
    $('#eo-map-min-zoom').on('input', function() {
        var min = parseInt($(this).val(), 10);
        var max = parseInt($('#eo-map-max-zoom').val(), 10);

        if (min > max) {
            max = min;
            $('#eo-map-max-zoom').val(max);
            $('#eo-map-max-zoom-value').text(max);
        }

        $('#eo-map-min-zoom-value').text(min);
        leafletMap.setMinZoom(min);
        leafletMap.setMaxZoom(max);
        markChangesAsUnsaved();
    });

    // Zoom maximal slider: never allow it to go below the current zoom minimal value.
    $('#eo-map-max-zoom').on('input', function() {
        var max = parseInt($(this).val(), 10);
        var min = parseInt($('#eo-map-min-zoom').val(), 10);

        if (max < min) {
            min = max;
            $('#eo-map-min-zoom').val(min);
            $('#eo-map-min-zoom-value').text(min);
        }

        $('#eo-map-max-zoom-value').text(max);
        leafletMap.setMinZoom(min);
        leafletMap.setMaxZoom(max);
        markChangesAsUnsaved();
    });

    // Flag to avoid triggering unsaved changes on initial map load
    var isMapInitialized = false;

    // Handle map style dropdown change
    $('#eo-map-style').on('change', function() {
        var styleKey = $(this).val();
        toggleOpenFreeMapFields(styleKey);
        var ofm = currentOpenFreeMapSettings();
        setTileLayer(styleKey, ofm.lang, ofm.design);
        applyZoomProviderLimits(styleKey);
        markChangesAsUnsaved();
    });

    // Handle map design/language dropdown change (OpenFreeMap only)
    $('#eo-map-design, #eo-map-language').on('change', function() {
        var ofm = currentOpenFreeMapSettings();
        setTileLayer($('#eo-map-style').val(), ofm.lang, ofm.design);
        markChangesAsUnsaved();
    });

    // Sync viewport coordinates on map move/zoom
    leafletMap.on('moveend zoomend', function() {
        var center = leafletMap.getCenter();
        var zoom = leafletMap.getZoom();
        
        $('#eo-map-center-lat').val(center.lat.toFixed(6));
        $('#eo-map-center-lng').val(center.lng.toFixed(6));
        $('#eo-map-zoom').val(zoom);

        if (isMapInitialized) {
            markChangesAsUnsaved();
        }
    });

    // Monitor input changes
    $('#eo-map-title-input, #eo-map-width, #eo-map-height').on('input', function() {
        markChangesAsUnsaved();
    });

    // Add marker helper
    function addMarkerToLeafletMap(markerData) {
        var customIcon = createMarkerIcon(markerData);

        var marker = L.marker([markerData.lat, markerData.lng], {
            icon: customIcon,
            draggable: true
        }).addTo(leafletMap);

        // Build popup content
        var popupHtml = '<div style="min-width: 150px; max-width: 250px;">';
        popupHtml += '<strong>' + escapeHtml(markerData.title || 'Marqueur') + '</strong>';
        if (markerData.description) {
            popupHtml += '<div style="margin: 5px 0 0 0; font-size:12px; line-height: 1.4; color:#555;">' + formatMarkerDescription(markerData.description) + '</div>';
        }
        if (markerData.phone) {
            popupHtml += '<p style="margin: 5px 0 0 0; font-size:11px; color:#555;"><span class="dashicons dashicons-phone" style="font-size:12px; width:auto; height:auto; vertical-align:middle; margin-right:4px;"></span><a href="tel:' + escapeHtml(markerData.phone) + '">' + escapeHtml(markerData.phone) + '</a></p>';
        }
        if (markerData.url) {
            var linkLabel = markerData.link_label || 'En savoir plus';
            if (!linkLabel.match(/(→|->|=>|&rarr;)$/)) {
                linkLabel += ' →';
            }
            popupHtml += '<p style="margin: 5px 0 0 0; font-size:11px;"><a href="' + esc_url(markerData.url) + '" target="_blank">' + escapeHtml(linkLabel) + '</a></p>';
        }
        if (markerData.gallery && markerData.gallery.length > 0) {
            popupHtml += '<div class="eo-map-popup-gallery" style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 4px; margin-top:8px;">';
            markerData.gallery.forEach(function(imgUrl) {
                popupHtml += '<img src="' + esc_url(imgUrl) + '" style="width:100%; height:40px; object-fit:cover; border-radius:3px;" />';
            });
            popupHtml += '</div>';
        }
        popupHtml += '<div style="margin-top: 8px; border-top:1px solid #eee; padding-top:5px; text-align:right;">';
        popupHtml += '<button type="button" class="eo-popup-edit-btn" data-id="' + markerData.id + '" style="background:none; border:none; cursor:pointer; color:#2271b1; font-size:11px; padding:0 5px;">Modifier</button>';
        popupHtml += '<button type="button" class="eo-popup-delete-btn" data-id="' + markerData.id + '" style="background:none; border:none; cursor:pointer; color:#b32d2e; font-size:11px; padding:0 5px;">Supprimer</button>';
        popupHtml += '</div>';
        popupHtml += '</div>';

        marker.bindPopup(popupHtml);

        // Popup buttons click actions
        marker.on('popupopen', function() {
            $('.eo-popup-edit-btn').off('click').on('click', function() {
                var id = $(this).data('id');
                editMarkerForm(id);
                leafletMap.closePopup();
            });
            $('.eo-popup-delete-btn').off('click').on('click', function() {
                var id = $(this).data('id');
                if (confirm('Supprimer ce marqueur ?')) {
                    deleteMarker(id);
                }
                leafletMap.closePopup();
            });
        });

        // Sync coordinates when dragging the marker
        marker.on('dragend', function(e) {
            var latlng = e.target.getLatLng();
            markerData.lat = latlng.lat;
            markerData.lng = latlng.lng;
            updateMarkersListUI();
            saveMap();

            // If this marker is currently loaded in the editing form, update fields
            if ($('#eo-marker-form-id').val() === markerData.id) {
                $('#eo-marker-lat').val(latlng.lat.toFixed(6));
                $('#eo-marker-lng').val(latlng.lng.toFixed(6));
            }
        });

        leafletMarkersMap[markerData.id] = marker;
    }

    // Helper: Esc URL
    function esc_url(url) {
        return escapeHtml(url);
    }

    // Render all markers onto the map
    function renderMarkersOnMap() {
        // Clear old markers from map
        Object.keys(leafletMarkersMap).forEach(function(id) {
            leafletMap.removeLayer(leafletMarkersMap[id]);
        });
        leafletMarkersMap = {};

        // Add each marker
        markersList.forEach(function(markerData) {
            addMarkerToLeafletMap(markerData);
        });
    }

    // Initialize markers render
    renderMarkersOnMap();

    var tempMarker = null;

    function setTempMarker(lat, lng) {
        var markerType = $('#eo-marker-type').val();
        var color = $('#eo-marker-color').val();
        var animation = $('#eo-marker-animation').val();
        var icon = $('#eo-marker-icon-url').val();
        
        var dummyData = {
            marker_type: markerType,
            color: color,
            animation: animation,
            icon: icon
        };
        var currentIcon = createMarkerIcon(dummyData);

        if (tempMarker) {
            tempMarker.setLatLng([lat, lng]);
            tempMarker.setIcon(currentIcon);
        } else {
            tempMarker = L.marker([lat, lng], {
                icon: currentIcon,
                draggable: true
            }).addTo(leafletMap);

            tempMarker.on('dragend', function(e) {
                var latlng = e.target.getLatLng();
                $('#eo-marker-lat').val(latlng.lat.toFixed(6));
                $('#eo-marker-lng').val(latlng.lng.toFixed(6));
            });
        }
    }

    function removeTempMarker() {
        if (tempMarker) {
            leafletMap.removeLayer(tempMarker);
            tempMarker = null;
        }
    }

    // 3. Click Map to place pin
    leafletMap.on('click', function(e) {
        var lat = e.latlng.lat;
        var lng = e.latlng.lng;

        // If form section is not visible, trigger Add Marker mode
        if ($('#eo-marker-form-section').is(':hidden')) {
            // Trigger tab markers if not active
            $('.eo-maps-tab-link[data-tab="tab-markers"]').trigger('click');
            $('#eo-add-marker-trigger').trigger('click');
        }

        var editId = $('#eo-marker-form-id').val();
        if (editId) {
            var existingMarker = leafletMarkersMap[editId];
            if (existingMarker) {
                existingMarker.setLatLng([lat, lng]);
            }
        } else {
            setTempMarker(lat, lng);
        }

        // Fill lat/lng in the form
        $('#eo-marker-lat').val(lat.toFixed(6));
        $('#eo-marker-lng').val(lng.toFixed(6));
        $('#eo-marker-address-search').val('');
    });

    // 4. Update the Sidebar Markers List UI
    function updateMarkersListUI() {
        var $container = $('#eo-markers-list-container');
        $container.empty();

        if (markersList.length === 0) {
            $container.html('<p style="color:#666; font-style:italic; text-align:center; padding:10px 0;">Aucun marqueur créé pour le moment.</p>');
            return;
        }

        markersList.forEach(function(marker) {
            var $item = $('<div class="eo-marker-item" data-id="' + marker.id + '">' +
                '<div class="eo-marker-item-info">' +
                    '<h4 class="eo-marker-item-title">' + escapeHtml(marker.title || 'Sans titre') + '</h4>' +
                    '<p class="eo-marker-item-coords">' + marker.lat.toFixed(4) + ', ' + marker.lng.toFixed(4) + '</p>' +
                '</div>' +
                '<div class="eo-marker-item-actions">' +
                    '<button type="button" class="eo-marker-center-btn" title="Centrer la carte"><span class="dashicons dashicons-location"></span></button>' +
                    '<button type="button" class="eo-marker-edit-btn" title="Modifier"><span class="dashicons dashicons-edit"></span></button>' +
                    '<button type="button" class="eo-marker-delete-btn" title="Supprimer"><span class="dashicons dashicons-trash"></span></button>' +
                '</div>' +
            '</div>');

            // Hook item actions
            $item.find('.eo-marker-center-btn').on('click', function() {
                leafletMap.flyTo([marker.lat, marker.lng], 15);
                leafletMarkersMap[marker.id].openPopup();
            });

            $item.find('.eo-marker-edit-btn').on('click', function() {
                editMarkerForm(marker.id);
            });

            $item.find('.eo-marker-delete-btn').on('click', function() {
                if (confirm('Supprimer ce marqueur ?')) {
                    deleteMarker(marker.id);
                }
            });

            $container.append($item);
        });
    }

    updateMarkersListUI();

    // 5. Marker CRUD & Form Operations
    $('#eo-add-marker-trigger').on('click', function() {
        // Clear form
        $('#eo-marker-form-title').text('Créer un marqueur');
        $('#eo-marker-form-id').val('');
        $('#eo-marker-lat').val('');
        $('#eo-marker-lng').val('');
        $('#eo-marker-address-search').val('');
        $('#eo-marker-title').val('');
        $('#eo-marker-description').val('');
        $('#eo-marker-url').val('');
        $('#eo-marker-link-label').val('');
        $('#eo-marker-phone').val('');
        $('#eo-marker-category').val('');
        $('#eo-marker-type').val('default').trigger('change');
        $('#eo-marker-color').val('#0066ff');
        $('#eo-marker-color-value').text('#0066FF');
        $('#eo-marker-animation').val('bounce');
        $('#eo-marker-icon-url').val('');
        $('#eo-marker-icon-preview').html('<span class="dashicons dashicons-image-alt" style="font-size: 20px; width: auto; height: auto; color: #bbb;"></span>');
        
        currentGallery = [];
        renderGalleryPreview();

        // Switch panel views
        $('#eo-markers-list-section').hide();
        $('#eo-marker-form-section').fadeIn();
    });

    $('#eo-cancel-marker-btn').on('click', function() {
        removeTempMarker();
        $('#eo-marker-form-section').hide();
        $('#eo-markers-list-section').fadeIn();
    });

    function editMarkerForm(id) {
        var marker = markersList.find(function(m) { return m.id === id; });
        if (!marker) return;

        // Trigger Tab Markers
        $('.eo-maps-tab-link[data-tab="tab-markers"]').trigger('click');

        // Populate Form
        $('#eo-marker-form-title').text('Modifier le marqueur');
        $('#eo-marker-form-id').val(marker.id);
        $('#eo-marker-lat').val(marker.lat.toFixed(6));
        $('#eo-marker-lng').val(marker.lng.toFixed(6));
        $('#eo-marker-address-search').val('');
        $('#eo-marker-title').val(marker.title);
        $('#eo-marker-description').val(marker.description);
        $('#eo-marker-url').val(marker.url);
        $('#eo-marker-link-label').val(marker.link_label || '');
        $('#eo-marker-phone').val(marker.phone || '');
        $('#eo-marker-category').val(marker.category);
        $('#eo-marker-type').val(marker.marker_type || 'default').trigger('change');
        $('#eo-marker-color').val(marker.color || '#0066ff');
        $('#eo-marker-color-value').text((marker.color || '#0066ff').toUpperCase());
        $('#eo-marker-animation').val(marker.animation || 'bounce');
        
        if (marker.icon) {
            $('#eo-marker-icon-url').val(marker.icon);
            $('#eo-marker-icon-preview').html('<img src="' + marker.icon + '" style="max-width:100%; max-height:100%; object-fit:contain;" />');
        } else {
            $('#eo-marker-icon-url').val('');
            $('#eo-marker-icon-preview').html('<span class="dashicons dashicons-image-alt" style="font-size: 20px; width: auto; height: auto; color: #bbb;"></span>');
        }

        currentGallery = marker.gallery ? [...marker.gallery] : [];
        renderGalleryPreview();

        // Switch panels
        $('#eo-markers-list-section').hide();
        $('#eo-marker-form-section').fadeIn();

        // Center map on marker
        leafletMap.panTo([marker.lat, marker.lng]);
    }

    function deleteMarker(id) {
        markersList = markersList.filter(function(m) { return m.id !== id; });
        if (leafletMarkersMap[id]) {
            leafletMap.removeLayer(leafletMarkersMap[id]);
            delete leafletMarkersMap[id];
        }
        updateMarkersListUI();
        saveMap();
    }

    // Address Search (Nominatim Geocoding API)
    function performAddressSearch() {
        var query = $('#eo-marker-address-search').val().trim();
        if (!query) return;

        var $btn = $('#eo-marker-address-search-btn');
        var originalText = $btn.text();
        $btn.text('Recherche...').prop('disabled', true);

        // Fetch using OSM Nominatim geocoder
        $.getJSON('https://nominatim.openstreetmap.org/search', {
            q: query,
            format: 'json',
            limit: 1
        }, function(data) {
            $btn.text(originalText).prop('disabled', false);
            if (data && data.length > 0) {
                var lat = parseFloat(data[0].lat);
                var lon = parseFloat(data[0].lon);

                $('#eo-marker-lat').val(lat.toFixed(6));
                $('#eo-marker-lng').val(lon.toFixed(6));

                var editId = $('#eo-marker-form-id').val();
                if (editId) {
                    var existingMarker = leafletMarkersMap[editId];
                    if (existingMarker) {
                        existingMarker.setLatLng([lat, lon]);
                    }
                } else {
                    setTempMarker(lat, lon);
                }

                // Pan and zoom map
                leafletMap.flyTo([lat, lon], 15);
            } else {
                alert('Adresse introuvable. Veuillez réessayer en précisant la ville ou le pays.');
            }
        }).fail(function() {
            $btn.text(originalText).prop('disabled', false);
            alert('Une erreur de connexion au service de géocodage est survenue.');
        });
    }

    $('#eo-marker-address-search-btn').on('click', function(e) {
        e.preventDefault();
        performAddressSearch();
    });

    $('#eo-marker-address-search').on('keypress', function(e) {
        if (e.which === 13) {
            e.preventDefault();
            performAddressSearch();
        }
    });

    // WordPress Media Uploader for Custom Icon
    var customIconUploader = null;
    $('#eo-marker-icon-select-btn').on('click', function(e) {
        e.preventDefault();

        if (customIconUploader) {
            customIconUploader.open();
            return;
        }

        customIconUploader = wp.media({
            title: 'Sélectionner l\'icône du marqueur',
            button: {
                text: 'Utiliser comme icône'
            },
            multiple: false
        });

        customIconUploader.on('select', function() {
            var attachment = customIconUploader.state().get('selection').first().toJSON();
            $('#eo-marker-icon-url').val(attachment.url);
            $('#eo-marker-icon-preview').html('<img src="' + attachment.url + '" style="max-width:100%; max-height:100%; object-fit:contain;" />');
            updateActiveMarkerIcon();
        });

        customIconUploader.open();
    });

    $('#eo-marker-icon-reset-btn').on('click', function(e) {
        e.preventDefault();
        $('#eo-marker-icon-url').val('');
        $('#eo-marker-icon-preview').html('<span class="dashicons dashicons-image-alt" style="font-size: 20px; width: auto; height: auto; color: #bbb;"></span>');
        updateActiveMarkerIcon();
    });

    // Helper: Update icon in real-time for active editing marker
    function updateActiveMarkerIcon() {
        var id = $('#eo-marker-form-id').val();
        var markerType = $('#eo-marker-type').val();
        var color = $('#eo-marker-color').val();
        var animation = $('#eo-marker-animation').val();
        var icon = $('#eo-marker-icon-url').val();
        
        var dummyData = {
            marker_type: markerType,
            color: color,
            animation: animation,
            icon: icon
        };
        var iconObject = createMarkerIcon(dummyData);
        
        if (id && leafletMarkersMap[id]) {
            leafletMarkersMap[id].setIcon(iconObject);
        } else if (tempMarker) {
            tempMarker.setIcon(iconObject);
        }
    }

    // Bind real-time form event updates
    $('#eo-marker-type').on('change', function() {
        var markerType = $(this).val();
        if (markerType === 'svg_pin' || markerType === 'svg_circle') {
            $('#eo-marker-color-group').show();
            $('#eo-marker-custom-icon-group').hide();
        } else {
            $('#eo-marker-color-group').hide();
            $('#eo-marker-custom-icon-group').show();
        }
        updateActiveMarkerIcon();
    });

    $('#eo-marker-color').on('input change', function() {
        $('#eo-marker-color-value').text($(this).val().toUpperCase());
        updateActiveMarkerIcon();
    });

    $('#eo-marker-animation').on('change', function() {
        updateActiveMarkerIcon();
    });

    // WordPress Media Uploader for Gallery Photos
    var galleryUploader = null;
    $('#eo-marker-gallery-select-btn').on('click', function(e) {
        e.preventDefault();

        if (galleryUploader) {
            galleryUploader.open();
            return;
        }

        galleryUploader = wp.media({
            title: eoMapsAdmin.mediaTitle,
            button: {
                text: eoMapsAdmin.mediaButton
            },
            multiple: true
        });

        galleryUploader.on('select', function() {
            var selection = galleryUploader.state().get('selection');
            selection.map(function(attachment) {
                attachment = attachment.toJSON();
                // Add url if not already present
                if (currentGallery.indexOf(attachment.url) === -1) {
                    currentGallery.push(attachment.url);
                }
            });
            renderGalleryPreview();
        });

        galleryUploader.open();
    });

    function renderGalleryPreview() {
        var $preview = $('#eo-marker-gallery-preview');
        $preview.empty();

        currentGallery.forEach(function(imgUrl, index) {
            var $wrapper = $('<div class="eo-gallery-image-wrapper">' +
                '<img src="' + imgUrl + '" />' +
                '<button type="button" class="eo-gallery-image-delete" data-index="' + index + '">&times;</button>' +
            '</div>');

            $wrapper.find('.eo-gallery-image-delete').on('click', function() {
                var idx = parseInt($(this).data('index'));
                currentGallery.splice(idx, 1);
                renderGalleryPreview();
            });

            $preview.append($wrapper);
        });
    }

    // Save Marker form action
    $('#eo-save-marker-btn').on('click', function(e) {
        e.preventDefault();
        
        var id = $('#eo-marker-form-id').val();
        var lat = parseFloat($('#eo-marker-lat').val());
        var lng = parseFloat($('#eo-marker-lng').val());
        var title = $('#eo-marker-title').val().trim();
        var desc = $('#eo-marker-description').val().trim();
        var url = $('#eo-marker-url').val().trim();
        var linkLabel = $('#eo-marker-link-label').val().trim();
        var phone = $('#eo-marker-phone').val().trim();
        var category = $('#eo-marker-category').val().trim();
        var icon = $('#eo-marker-icon-url').val();
        var markerType = $('#eo-marker-type').val();
        var color = $('#eo-marker-color').val();
        var animation = $('#eo-marker-animation').val();

        if (isNaN(lat) || isNaN(lng)) {
            alert('Coordonnées de marqueur invalides. Cliquez sur la carte ou effectuez une recherche d\'adresse.');
            return;
        }

        if (!title) {
            alert('Veuillez renseigner le titre du marqueur.');
            return;
        }

        var markerData = {
            id: id || 'm_' + Math.random().toString(36).substr(2, 9),
            lat: lat,
            lng: lng,
            title: title,
            description: desc,
            url: url,
            link_label: linkLabel,
            phone: phone,
            category: category,
            icon: icon,
            marker_type: markerType,
            color: color,
            animation: animation,
            gallery: currentGallery
        };

        if (id) {
            // Update existing
            var idx = markersList.findIndex(function(m) { return m.id === id; });
            if (idx !== -1) {
                markersList[idx] = markerData;
            }
        } else {
            // Insert new
            markersList.push(markerData);
        }

        // Re-render markers on map and sidebar UI
        removeTempMarker();
        renderMarkersOnMap();
        updateMarkersListUI();
        saveMap();

        // Switch screens back
        $('#eo-marker-form-section').hide();
        $('#eo-markers-list-section').fadeIn();
    });

    // 6. Save Map configuration (Map Options + Markers list)
    $('#eo-save-map-btn').on('click', function(e) {
        e.preventDefault();
        saveMap();
    });

    // Set initial button state (saved since no changes yet) and flag map as ready
    setSaveButtonState('saved');
    isMapInitialized = true;

});
