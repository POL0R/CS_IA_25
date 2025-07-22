from datetime import datetime, timedelta

def calculate_project_end_date(project_data):
    """
    Calculates the estimated end date of a project based on its tasks,
    dependencies, and other factors.
    """
    start_date = datetime.fromisoformat(project_data['start_date'].split('T')[0])
    tasks = project_data.get('tasks', [])
    working_hours_per_day = project_data.get('working_hours_per_day', 8)
    holidays_str = project_data.get('holidays', [])
    holidays = [datetime.fromisoformat(h.split('T')[0]) for h in holidays_str]
    material_requirements = project_data.get('material_requirements', [])
    approval_buffer_days = project_data.get('approval_buffer_days', 0)
    
    # --- Advanced Calculation Logic ---
    
    # 1. Calculate total duration from tasks
    total_task_duration_days = sum(float(task.get('duration_days', 0)) for task in tasks)
    
    # 2. Factor in material lead times
    max_lead_time = 0
    for material in material_requirements:
        if not material.get('in_stock', True):
            max_lead_time = max(max_lead_time, int(material.get('lead_time', 0)))
            
    # 3. Combine durations
    total_duration = total_task_duration_days + max_lead_time + approval_buffer_days
    
    # 4. Calculate end date considering work days, weekends, and holidays
    current_date = start_date
    days_to_add = total_duration
    
    while days_to_add > 0:
        current_date += timedelta(days=1)
        # Weekends (Saturday=5, Sunday=6)
        if current_date.weekday() >= 5:
            continue
        # Holidays
        if current_date in holidays:
            continue
        days_to_add -= 1
        
    return current_date 