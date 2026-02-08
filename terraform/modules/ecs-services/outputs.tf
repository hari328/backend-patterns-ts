output "service_ids" {
  description = "Map of service name to ECS service ID"
  value       = { for name, svc in module.ecs_service : name => svc.id }
}

output "service_names" {
  description = "Map of service name to ECS service name"
  value       = { for name, svc in module.ecs_service : name => svc.name }
}

output "task_definition_arns" {
  description = "Map of service name to task definition ARN"
  value       = { for name, svc in module.ecs_service : name => svc.task_definition_arn }
}

output "task_definition_families" {
  description = "Map of service name to task definition family"
  value       = { for name, svc in module.ecs_service : name => svc.task_definition_family }
}

output "target_group_arns" {
  description = "Map of service name to ALB target group ARN"
  value       = { for name, tg in aws_lb_target_group.this : name => tg.arn }
}
