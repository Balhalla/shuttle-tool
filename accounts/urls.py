"""URL patterns for accounts app."""
from django.urls import path
from . import views

urlpatterns = [
    path('request-link/', views.request_magic_link, name='request_magic_link'),
    path('verify/<str:token>/', views.verify_token, name='verify_token'),
    path('me/', views.get_current_user, name='current_user'),
    path('logout/', views.logout, name='logout'),
]
