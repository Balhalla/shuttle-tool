"""URL patterns for shuttle app."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'admin/cars', views.AdminCarViewSet, basename='admin-car')
router.register(r'admin/locations', views.AdminLocationViewSet, basename='admin-location')
router.register(r'admin/rides', views.AdminRideViewSet, basename='admin-ride')
router.register(r'admin/drivers', views.AdminDriverViewSet, basename='admin-driver')
router.register(r'admin/users', views.AdminUserViewSet, basename='admin-user')
router.register(r'admin/reservations', views.AdminReservationViewSet, basename='admin-reservation')
router.register(r'admin/travel-times', views.AdminTravelTimeViewSet, basename='admin-travel-time')
router.register(r'admin/driver-availabilities', views.AdminDriverAvailabilityViewSet, basename='admin-driver-availability')

urlpatterns = [
    # Config
    path('config/', views.app_config, name='app_config'),

    # Public endpoints
    path('rides/', views.public_ride_list, name='public_ride_list'),
    path('rides/<int:ride_id>/', views.public_ride_detail, name='public_ride_detail'),
    path('rides/<int:ride_id>/reserve/', views.reserve_ride, name='reserve_ride'),
    path('confirm/<str:token>/', views.confirm_reservation, name='confirm_reservation'),
    path('locations/', views.location_list, name='location_list'),

    # User endpoints (authenticated)
    path('my/reservations/', views.my_reservations, name='my_reservations'),
    path('my/reservations/<int:reservation_id>/cancel/', views.cancel_my_reservation, name='cancel_my_reservation'),

    # Driver endpoints
    path('driver/rides/', views.driver_rides, name='driver_rides'),
    path('driver/rides/<int:ride_id>/', views.driver_ride_detail, name='driver_ride_detail'),
    path('driver/rides/<int:ride_id>/passengers/', views.driver_ride_passengers, name='driver_ride_passengers'),
    path('driver/rides/<int:ride_id>/passengers/<int:reservation_id>/present/', views.driver_mark_passenger_present, name='driver_mark_passenger_present'),
    path('driver/rides/<int:ride_id>/depart/', views.driver_depart, name='driver_depart'),

    # Admin endpoints (router)
    path('admin/passengers/', views.admin_passenger_list, name='admin_passenger_list'),
    path('admin/driver-timeline/', views.admin_driver_timeline, name='admin_driver_timeline'),
    path('admin/settings/', views.admin_site_settings, name='admin_site_settings'),
    path('admin/car-km/', views.admin_car_km_overview, name='admin_car_km_overview'),
    path('', include(router.urls)),
]
