from django.contrib import admin

from .models import UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
	list_display = ("user", "full_name", "phone", "role")
	list_filter = ("role",)
	search_fields = ("user__username", "full_name", "phone", "user__email")
	autocomplete_fields = ("user",)
